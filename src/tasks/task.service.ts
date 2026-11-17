import { UPLOADS_DIRECTORY } from '../shared/constants/app.constants.js';
import { FileFormatEnum } from '../shared/enums/fileFormatEnum.js';
import { TaskStatusEnum } from '../shared/enums/taskStatusEnum.js';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Task } from './task.model.js';

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
}

export function updateTaskResult(result: Task): void {
    const task = tasks.get(result.task_id);
    // Resultados de tarefas anteriores ao reinício não têm estado local recuperável.
    if (!task) return;

    if (result.status !== TaskStatusEnum.COMPLETED && result.status !== TaskStatusEnum.FAILED) {
        throw new Error('Estado inválido no resultado da tarefa.');
    }
    if (!result.timestamps?.finalizado_em ||
        (result.status === TaskStatusEnum.COMPLETED && !result.caminho_resultado)) {
        throw new Error('Resultado de tarefa incompleto.');
    }

    task.status = result.status;
    task.timestamps.iniciado_em = result.timestamps.iniciado_em;
    task.timestamps.finalizado_em = result.timestamps.finalizado_em;
    task.caminho_resultado = result.status === TaskStatusEnum.COMPLETED ? result.caminho_resultado : null;
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
    return task;
}
