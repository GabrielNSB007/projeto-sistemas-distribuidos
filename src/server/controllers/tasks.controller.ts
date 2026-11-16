import { UPLOAD_FIELDS } from '../../shared/constants/app.constants.js';
import { HttpStatusEnum } from '../../shared/enums/httpStatusEnum.js';
import { FileFormatEnum } from '../../shared/enums/fileFormatEnum.js';
import { MessagesEnum } from '../../shared/enums/messagesEnum.js';
import type { NextFunction, Request, Response } from 'express';
import path from 'node:path';
import { TaskStatusEnum } from '../../shared/enums/taskStatusEnum.js';
import { isUtf8 } from 'node:buffer';
import { createTask, getTaskById } from '../../tasks/task.service.js';

type TaskParams = {
    id: string;
};

export class TaskController {
    download(req: Request<TaskParams>, res: Response, next: NextFunction): void {
        const task = getTaskById(req.params.id);

        if (!task) {
            res.status(HttpStatusEnum.NOT_FOUND).json({ erro: MessagesEnum.TASK_NOT_FOUND });
            return;
        }

        if (task.status !== TaskStatusEnum.COMPLETED) {
            res.status(HttpStatusEnum.CONFLICT).json({ erro: MessagesEnum.TASK_NOT_COMPLETED });
            return;
        }

        if (!task.caminho_resultado) {
            res.status(HttpStatusEnum.NOT_FOUND).json({ erro: MessagesEnum.RESULT_NOT_FOUND });
            return;
        }

        const fileName = `${path.parse(task.nome_arquivo).name}.${FileFormatEnum.PDF}`;
        res.download(path.resolve(task.caminho_resultado), fileName, (error) => {
            if (!error) return;

            if (!res.headersSent && (error as NodeJS.ErrnoException).code === 'ENOENT') {
                res.status(HttpStatusEnum.NOT_FOUND).json({ erro: MessagesEnum.RESULT_NOT_FOUND });
                return;
            }

            next(error);
        });
    }

    show(req: Request<TaskParams>, res: Response): void {
        const task = getTaskById(req.params.id);

        if (!task) {
            res.status(HttpStatusEnum.NOT_FOUND).json({ erro: MessagesEnum.TASK_NOT_FOUND });
            return;
        }

        res.status(HttpStatusEnum.OK).json(task);
    }

    async create(req: Request, res: Response): Promise<void> {
        if (!req.file) {
            res.status(HttpStatusEnum.BAD_REQUEST).json({ erro: MessagesEnum.FILE_REQUIRED });
            return;
        }

        if (!req.file.originalname.toLowerCase().endsWith(`.${FileFormatEnum.TXT}`)) {
            res.status(HttpStatusEnum.BAD_REQUEST).json({ erro: MessagesEnum.INVALID_SOURCE_FORMAT });
            return;
        }

        if (req.body[UPLOAD_FIELDS.TARGET_FORMAT] !== FileFormatEnum.PDF) {
            res.status(HttpStatusEnum.BAD_REQUEST).json({ erro: MessagesEnum.INVALID_TARGET_FORMAT });
            return;
        }

        if (req.file.size === 0 || !isUtf8(req.file.buffer)) {
            res.status(HttpStatusEnum.BAD_REQUEST).json({ erro: MessagesEnum.INVALID_TEXT_FILE });
            return;
        }

        const task = await createTask(req.file.originalname, req.file.buffer);
        res.status(HttpStatusEnum.ACCEPTED).json({ task_id: task.task_id, status: task.status });
    }
}
