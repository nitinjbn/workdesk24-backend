import { Router } from 'express';
import hostController from '../../../modules/superadmin/controllers/host.controller';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/hosts/createHost',
  upload.single('media'),
  hostController.createHost.bind(hostController)
);
// router.post(
//   '/hosts/updateHost',
//   upload.single('media'),
//   hostController.updateHost.bind(hostController)
// );
//router.post('/hosts/deleteHost', hostController.deleteHost.bind(hostController));

export default router;
