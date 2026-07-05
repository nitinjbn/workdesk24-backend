import { Router } from 'express';
import multer from 'multer';
import userController from '../../../modules/master/controllers/user.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/users/getDesignations', userController.getDesignations.bind(userController));
router.post('/users/getRoles', userController.getRoles.bind(userController));
router.post('/users/getUsers', userController.getAppUsers.bind(userController));
router.post('/users/getUserDetails', userController.getUserDetails.bind(userController));
router.post('/users/createUser', upload.single('media'), userController.createAppUser.bind(userController));

export default router;
