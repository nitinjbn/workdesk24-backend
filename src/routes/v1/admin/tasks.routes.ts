import { Router } from 'express';
import taskController from '../../../modules/task/controllers/task.controller';
import taskCategoryController from '../../../modules/task/controllers/task-category.controller';
import taskTagController from '../../../modules/task/controllers/task-tag.controller';
import {
  taskUpload,
  taskUploadErrorHandler,
} from '../../../modules/task/middleware/task-upload.middleware';

const router = Router();

router.post('/task-tags/list', taskTagController.list);
router.post('/task-tags/list-enabled', taskTagController.listEnabled);
router.post('/task-tags/create', taskTagController.create);
router.post('/task-tags/update', taskTagController.update);
router.post('/task-tags/detail', taskTagController.detail);
router.post('/task-tags/delete', taskTagController.remove);
router.post('/task-tags/toggle-status', taskTagController.toggleStatus);
router.post('/update-tags', taskController.updateTags);

router.post('/task-categories/list', taskCategoryController.list);
router.post('/task-categories/create', taskCategoryController.create);
router.post('/task-categories/update', taskCategoryController.update);
router.post('/task-categories/detail', taskCategoryController.detail);
router.post('/task-categories/delete', taskCategoryController.remove);
router.post('/task-categories/toggle-status', taskCategoryController.toggleStatus);

router.post('/dashboard-stats', taskController.dashboardStats);
router.post('/kanban-board', taskController.kanbanBoard);
router.post('/createTask', taskController.createTask);
router.post(
  '/createTaskWithAttachment',
  taskUpload.single('file'),
  taskUploadErrorHandler,
  taskController.createTaskWithAttachment
);
router.post('/getTasks', taskController.getTasks);
router.post('/getTaskDetails', taskController.getTaskDetails);
router.post('/updateTask', taskController.updateTask);
router.post('/assignTask', taskController.assignTask);
router.post('/startTask', taskController.startTask);
router.post('/completeTask', taskController.completeTask);
router.post('/updateTaskStatus', taskController.updateTaskStatus);
router.post('/cancelTask', taskController.cancelTask);
router.post('/getTaskActivity', taskController.getTaskActivity);
router.post('/addTaskComment', taskController.addTaskComment);
router.post(
  '/addTaskCommentWithAttachment',
  taskUpload.single('file'),
  taskUploadErrorHandler,
  taskController.addTaskCommentWithAttachment
);
router.post('/getTaskComments', taskController.getTaskComments);
router.post(
  '/uploadTaskAttachment',
  taskUpload.single('file'),
  taskUploadErrorHandler,
  taskController.uploadTaskAttachment
);
router.post('/getTaskAttachments', taskController.getTaskAttachments);
router.post('/getTaskAttachment', taskController.getTaskAttachment);

export default router;
