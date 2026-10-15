import { Router } from 'express';
import taskController from '../../../modules/task/controllers/task.controller';
import { taskUpload, taskUploadErrorHandler } from '../../../modules/task/middleware/task-upload.middleware';

const router = Router();

router.post('/getTasks', taskController.getTasks);
router.post('/getTaskDetails', taskController.getTaskDetails);
router.post('/startTask', taskController.startTask);
router.post('/completeTask', taskController.completeTask);
router.post('/cancelTask', taskController.cancelTask);
router.post('/getTaskActivity', taskController.getTaskActivity);
router.post('/addTaskComment', taskController.addTaskComment);
router.post('/getTaskComments', taskController.getTaskComments);
router.post('/uploadTaskAttachment', taskUpload.single('file'), taskUploadErrorHandler, taskController.uploadTaskAttachment);
router.post('/getTaskAttachments', taskController.getTaskAttachments);
router.post('/getTaskAttachment', taskController.getTaskAttachment);

export default router;