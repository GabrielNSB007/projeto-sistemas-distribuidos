import { UPLOAD_FIELDS } from '../../shared/constants/app.constants.js';
import { HttpStatusEnum } from '../../shared/enums/httpStatusEnum.js';
import { MessagesEnum } from '../../shared/enums/messagesEnum.js';
import type { NextFunction, Request, Response } from 'express';
import { TaskService } from '../services/tasks.service.js';

type TaskParams = {
    id: string;
};

export class TaskController {
    private readonly taskService = new TaskService();
    download(req: Request<TaskParams>, res: Response, next: NextFunction): void {
        const result = this.taskService.getDownload(req.params.id);
        res.download(result.path, result.fileName, (error) => {
            if (!error) return;

            if (!res.headersSent && (error as NodeJS.ErrnoException).code === 'ENOENT') {
                res.status(HttpStatusEnum.NOT_FOUND).json({ erro: MessagesEnum.RESULT_NOT_FOUND });
                return;
            }

            next(error);
        });
    }

    show(req: Request<TaskParams>, res: Response): void {
        const task = this.taskService.getById(req.params.id);
        res.status(HttpStatusEnum.OK).json(task);
    }

    async create(req: Request, res: Response): Promise<void> {
        if (!req.file) {
            res.status(HttpStatusEnum.BAD_REQUEST).json({ erro: MessagesEnum.FILE_REQUIRED });
            return;
        }

        const task = await this.taskService.create({
            fileName: req.file.originalname,
            file: req.file.buffer,
            targetFormat: req.body[UPLOAD_FIELDS.TARGET_FORMAT],
        });
        res.status(HttpStatusEnum.ACCEPTED).json({ task_id: task.task_id, status: task.status });
    }
}
