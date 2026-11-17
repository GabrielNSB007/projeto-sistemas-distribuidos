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
