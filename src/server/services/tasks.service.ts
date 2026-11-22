import { isUtf8 } from 'node:buffer';
import path from 'node:path';
import { FileFormatEnum } from '../../shared/enums/fileFormatEnum.js';
import { MessagesEnum } from '../../shared/enums/messagesEnum.js';
import { TaskStatusEnum } from '../../shared/enums/taskStatusEnum.js';
import type { Task } from '../../tasks/task.model.js';
import { createTask, getTaskById, markTaskAsFailed, updateTaskResult } from '../../tasks/task.service.js';
import queue from '../../broker/queue.js';
import { TASK_QUEUE, RESULT_QUEUE } from '../../broker/config.js';
import { logTaskLifecycle } from '../../shared/logging/task-lifecycle.js';

type CreateTaskInput = {
    fileName: string;
    file: Buffer;
    targetFormat: unknown;
};

export class TaskService {
    async startResultConsumer(): Promise<void> {
        await queue.consume(RESULT_QUEUE, updateTaskResult);
    }

    async create({ fileName, file, targetFormat }: CreateTaskInput): Promise<Task> {
        if (!fileName.toLowerCase().endsWith(`.${FileFormatEnum.TXT}`)) {
            logTaskLifecycle('task.validation_failed', null, { reason: 'invalid_source_format' });
            throw new Error(MessagesEnum.INVALID_SOURCE_FORMAT);
        }
        if (targetFormat !== FileFormatEnum.PDF) {
            logTaskLifecycle('task.validation_failed', null, { reason: 'invalid_target_format' });
            throw new Error(MessagesEnum.INVALID_TARGET_FORMAT);
        }
        if (file.length === 0 || !isUtf8(file)) {
            logTaskLifecycle('task.validation_failed', null, { reason: 'invalid_text_file' });
            throw new Error(MessagesEnum.INVALID_TEXT_FILE);
        }

        const task = await createTask(fileName, file);
        try {
            logTaskLifecycle('task.publication_started', task.task_id, {
                queue: TASK_QUEUE,
            });
            await queue.publish(TASK_QUEUE, task);
            logTaskLifecycle('task.accepted', task.task_id, {
                queue: TASK_QUEUE,
                status: task.status,
            });
        } catch (error) {
            markTaskAsFailed(task.task_id);
            logTaskLifecycle('task.publication_failed', task.task_id, {
                queue: TASK_QUEUE,
                error: error instanceof Error ? error.message : String(error),
            }, 'error');
            throw new Error(MessagesEnum.TASK_PUBLICATION_FAILED);
        }
        return task;
    }

    getById(taskId: string): Task {
        const task = getTaskById(taskId);
        if (!task) {
            logTaskLifecycle('task.lookup_failed', taskId, {}, 'error');
            throw new Error(MessagesEnum.TASK_NOT_FOUND);
        }
        return task;
    }

    getDownload(taskId: string): { path: string; fileName: string } {
        const task = this.getById(taskId);
        logTaskLifecycle('task.download_requested', taskId, { status: task.status });
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
