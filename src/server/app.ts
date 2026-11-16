import express from 'express';
import { HttpStatusEnum } from '../shared/enums/httpStatusEnum.js';
import { handleError } from './middlewares/error.middleware.js';
import { taskRoutes } from './routes/tasks.routes.js';

export const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
    res.status(HttpStatusEnum.OK).json({ status: 'ok' });
});

app.use('/tasks', taskRoutes);

app.use(handleError);
