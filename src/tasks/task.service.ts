import { UPLOADS_DIRECTORY } from '../shared/constants/app.constants.js';
import { FileFormatEnum } from '../shared/enums/fileFormatEnum.js';
import { TaskStatusEnum } from '../shared/enums/taskStatusEnum.js';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Task } from './task.model.js';
import { logTaskLifecycle } from '../shared/logging/task-lifecycle.js';

const tasks = new Map<string, Task>();
const UPLOADS_DIR = path.resolve(UPLOADS_DIRECTORY);

export function getTaskById(taskId: string): Task | undefined {
    return tasks.get(taskId);
}

export function markTaskAsFailed(taskId: string): void {
    const task = tasks.get(taskId);
    if (!task) return;
    task.status = TaskStatusEnum.FAILED;
    task.timestamps.finalizado_em = new Date().toISOString();
    logTaskLifecycle('task.marked_failed', taskId, { status: task.status }, 'error');
}

export function updateTaskResult(result: Task): void {
    const task = tasks.get(result.task_id);
    if (!task) {
        logTaskLifecycle('task.result_ignored_unknown', result.task_id, {
            status: result.status,
        });
        return;
    }

    if (result.status === TaskStatusEnum.PROCESSING) {
        if (task.status === TaskStatusEnum.PENDING) {
            if (!result.timestamps?.iniciado_em || result.timestamps.finalizado_em !== null) {
                throw new Error('Atualização intermediária da tarefa incompleta.');
            }
            task.status = result.status;
            task.timestamps.iniciado_em = result.timestamps.iniciado_em;
            logTaskLifecycle('task.status_updated', task.task_id, {
                previous_status: TaskStatusEnum.PENDING,
                status: task.status,
            });
        } else {
            logTaskLifecycle('task.status_update_ignored', task.task_id, {
                current_status: task.status,
                received_status: result.status,
            });
        }
        return;
    }

    if (result.status !== TaskStatusEnum.COMPLETED && result.status !== TaskStatusEnum.FAILED) {
        throw new Error('Estado inválido no resultado da tarefa.');
    }
    if (!result.timestamps?.finalizado_em ||
        (result.status === TaskStatusEnum.COMPLETED && !result.caminho_resultado)) {
        throw new Error('Resultado de tarefa incompleto.');
    }

    if (task.status === TaskStatusEnum.COMPLETED || task.status === TaskStatusEnum.FAILED) {
        if (task.status === result.status) {
            logTaskLifecycle('task.duplicate_result_ignored', task.task_id, {
                status: result.status,
            });
            return;
        }
        throw new Error('Resultado final conflitante para a tarefa.');
    }

    const previousStatus = task.status;
    task.status = result.status;
    task.timestamps.iniciado_em = result.timestamps.iniciado_em;
    task.timestamps.finalizado_em = result.timestamps.finalizado_em;
    task.caminho_resultado = result.status === TaskStatusEnum.COMPLETED ? result.caminho_resultado : null;
    logTaskLifecycle('task.status_updated', task.task_id, {
        previous_status: previousStatus,
        status: task.status,
    });
}

export async function createTask(fileName: string, file: Buffer): Promise<Task> {
    const taskId = randomUUID();

    await mkdir(UPLOADS_DIR, { recursive: true });
    // O nome original não é usado no caminho físico do upload.
    await writeFile(path.join(UPLOADS_DIR, `${taskId}.${FileFormatEnum.TXT}`), file, { flag: 'wx' });

    const task: Task = {
        task_id: taskId,
        nome_arquivo: fileName,
        formato_origem: FileFormatEnum.TXT,
        formato_destino: FileFormatEnum.PDF,
        status: TaskStatusEnum.PENDING,
        timestamps: {
            criado_em: new Date().toISOString(),
            iniciado_em: null,
            finalizado_em: null,
        },
        caminho_resultado: null,
    };

    tasks.set(taskId, task);
    logTaskLifecycle('task.created', taskId, {
        status: task.status,
        source_format: task.formato_origem,
        target_format: task.formato_destino,
    });
    return task;
}
