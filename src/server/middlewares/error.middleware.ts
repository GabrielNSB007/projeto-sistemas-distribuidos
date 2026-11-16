import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { HttpStatusEnum } from '../../shared/enums/httpStatusEnum.js';
import { FILE_TOO_LARGE_MESSAGE, MessagesEnum } from '../../shared/enums/messagesEnum.js';

export const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof multer.MulterError) {
        const isFileTooLarge = error.code === 'LIMIT_FILE_SIZE';
        res.status(isFileTooLarge ? HttpStatusEnum.PAYLOAD_TOO_LARGE : HttpStatusEnum.BAD_REQUEST).json({
            erro: isFileTooLarge
                ? FILE_TOO_LARGE_MESSAGE
                : MessagesEnum.INVALID_UPLOAD,
        });
        return;
    }

    console.error(error);
    res.status(HttpStatusEnum.INTERNAL_SERVER_ERROR).json({ erro: MessagesEnum.TASK_CREATION_FAILED });
};
