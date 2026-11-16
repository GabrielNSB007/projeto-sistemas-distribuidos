import { isUtf8 } from 'node:buffer';
import path from 'node:path';
import { FileFormatEnum } from '../../shared/enums/fileFormatEnum.js';
import { MessagesEnum } from '../../shared/enums/messagesEnum.js';
import { TaskStatusEnum } from '../../shared/enums/taskStatusEnum.js';
import type { Task } from '../../tasks/task.model.js';
import { createTask, getTaskById } from '../../tasks/task.service.js';

type CreateTaskInput = {
    fileName: string;
    file: Buffer;
    targetFormat: unknown;
};

export class TaskService {
    async create({ fileName, file, targetFormat }: CreateTaskInput): Promise<Task> {
        if (!fileName.toLowerCase().endsWith(`.${FileFormatEnum.TXT}`)) {
            throw new Error(MessagesEnum.INVALID_SOURCE_FORMAT);
        }
        if (targetFormat !== FileFormatEnum.PDF) {
            throw new Error(MessagesEnum.INVALID_TARGET_FORMAT);
        }
        if (file.length === 0 || !isUtf8(file)) {
            throw new Error(MessagesEnum.INVALID_TEXT_FILE);
        }

        return createTask(fileName, file);
    }

    getById(taskId: string): Task {
        const task = getTaskById(taskId);
        if (!task) {
            throw new Error(MessagesEnum.TASK_NOT_FOUND);
        }
        return task;
    }

    getDownload(taskId: string): { path: string; fileName: string } {
        const task = this.getById(taskId);
        if (task.status !== TaskStatusEnum.COMPLETED) {
            throw new Error(MessagesEnum.TASK_NOT_COMPLETED);
        }
        if (!task.caminho_resultado) {
            throw new Error(MessagesEnum.RESULT_NOT_FOUND);
        }

        return {
            path: path.resolve(task.caminho_resultado),
            fileName: `${path.parse(task.nome_arquivo).name}.${FileFormatEnum.PDF}`,
        };
    }
}
