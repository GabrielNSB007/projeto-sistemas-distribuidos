import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { HttpStatusEnum } from '../../shared/enums/httpStatusEnum.js';
import { FILE_TOO_LARGE_MESSAGE, MessagesEnum } from '../../shared/enums/messagesEnum.js';

const errorStatuses = new Map<string, HttpStatusEnum>([
    [MessagesEnum.INVALID_SOURCE_FORMAT, HttpStatusEnum.BAD_REQUEST],
    [MessagesEnum.INVALID_TARGET_FORMAT, HttpStatusEnum.BAD_REQUEST],
    [MessagesEnum.INVALID_TEXT_FILE, HttpStatusEnum.BAD_REQUEST],
    [MessagesEnum.TASK_NOT_FOUND, HttpStatusEnum.NOT_FOUND],
    [MessagesEnum.RESULT_NOT_FOUND, HttpStatusEnum.NOT_FOUND],
    [MessagesEnum.TASK_NOT_COMPLETED, HttpStatusEnum.CONFLICT],
]);

export const handleError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
        next(error);
        return;
    }

    if (error instanceof multer.MulterError) {
        const isFileTooLarge = error.code === 'LIMIT_FILE_SIZE';
        res.status(isFileTooLarge ? HttpStatusEnum.PAYLOAD_TOO_LARGE : HttpStatusEnum.BAD_REQUEST).json({
            erro: isFileTooLarge
                ? FILE_TOO_LARGE_MESSAGE
                : MessagesEnum.INVALID_UPLOAD,
        });
        return;
    }

    if (error instanceof Error) {
        const status = errorStatuses.get(error.message);
        if (status !== undefined) {
            res.status(status).json({ erro: error.message });
            return;
        }
    }

    console.error(error);
    res.status(HttpStatusEnum.INTERNAL_SERVER_ERROR).json({ erro: MessagesEnum.INTERNAL_SERVER_ERROR });
};
