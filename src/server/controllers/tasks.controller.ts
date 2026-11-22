import { UPLOAD_FIELDS } from '../../shared/constants/app.constants.js';
import { HttpStatusEnum } from '../../shared/enums/httpStatusEnum.js';
import { MessagesEnum } from '../../shared/enums/messagesEnum.js';
import type { NextFunction, Request, Response } from 'express';
import { TaskService } from '../services/tasks.service.js';
import { logTaskLifecycle } from '../../shared/logging/task-lifecycle.js';

type TaskParams = {
    id: string;
};

export class TaskController {
    private readonly taskService = new TaskService();
    download(req: Request<TaskParams>, res: Response, next: NextFunction): void {
        let result: ReturnType<TaskService['getDownload']>;
        try {
            result = this.taskService.getDownload(req.params.id);
        } catch (error) {
            logTaskLifecycle('task.download_rejected', req.params.id, {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }

        res.download(result.path, result.fileName, (error) => {
            if (!error) {
                logTaskLifecycle('task.download_completed', req.params.id, {
                    file_name: result.fileName,
                });
                return;
            }

            if (!res.headersSent && (error as NodeJS.ErrnoException).code === 'ENOENT') {
                logTaskLifecycle('task.download_file_missing', req.params.id, {
                    file_name: result.fileName,
                }, 'error');
                res.status(HttpStatusEnum.NOT_FOUND).json({ erro: MessagesEnum.RESULT_NOT_FOUND });
                return;
            }

            logTaskLifecycle('task.download_failed', req.params.id, {
                error: error.message,
            }, 'error');
            next(error);
        });
    }

    show(req: Request<TaskParams>, res: Response): void {
        const task = this.taskService.getById(req.params.id);
        logTaskLifecycle('task.status_queried', task.task_id, { status: task.status });
        res.status(HttpStatusEnum.OK).json(task);
    }

    async create(req: Request, res: Response): Promise<void> {
        if (!req.file) {
            logTaskLifecycle('task.upload_rejected', null, { reason: 'file_required' });
            res.status(HttpStatusEnum.BAD_REQUEST).json({ erro: MessagesEnum.FILE_REQUIRED });
            return;
        }

        logTaskLifecycle('task.upload_received', null, {
            file_size: req.file.size,
        });
        const task = await this.taskService.create({
            fileName: req.file.originalname,
            file: req.file.buffer,
            targetFormat: req.body[UPLOAD_FIELDS.TARGET_FORMAT],
        });
        res.status(HttpStatusEnum.ACCEPTED).json({ task_id: task.task_id, status: task.status });
    }
}
