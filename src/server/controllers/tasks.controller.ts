import { UPLOAD_FIELDS } from '../../shared/constants/app.constants.js';
import { HttpStatusEnum } from '../../shared/enums/httpStatusEnum.js';
import { FileFormatEnum } from '../../shared/enums/fileFormatEnum.js';
import { MessagesEnum } from '../../shared/enums/messagesEnum.js';
import type { Request, Response } from 'express';
import { isUtf8 } from 'node:buffer';
import { createTask } from '../../tasks/task.service.js';

export class TaskController {
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
