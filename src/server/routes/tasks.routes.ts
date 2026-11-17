import { UPLOAD_FIELDS } from '../../shared/constants/app.constants.js';
import { Router } from 'express';
import { TaskController } from '../controllers/tasks.controller.js';
import { upload } from '../middlewares/upload.middleware.js';

export const taskRoutes = Router();
const taskController = new TaskController();

taskRoutes.post('/', upload.single(UPLOAD_FIELDS.FILE), (req, res) => taskController.create(req, res));
taskRoutes.get('/:id', (req, res) => taskController.show(req, res));
taskRoutes.get('/:id/download', (req, res, next) => taskController.download(req, res, next));
