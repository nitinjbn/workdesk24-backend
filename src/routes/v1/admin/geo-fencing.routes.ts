import { Router } from 'express';
import geoFencingController from '../../../modules/geo-fencing/controllers/geo-fencing.controller';

const router = Router();

router.post(
  '/geo-fencing/createAttendanceSite',
  geoFencingController.createAttendanceSite.bind(geoFencingController)
);
router.post(
  '/geo-fencing/getAttendanceSites',
  geoFencingController.getAttendanceSites.bind(geoFencingController)
);
router.post(
  '/geo-fencing/updateAttendanceSite',
  geoFencingController.updateAttendanceSite.bind(geoFencingController)
);

router.post(
  '/geo-fencing/getAttendanceSiteById',
  geoFencingController.getAttendanceSiteById.bind(geoFencingController)
);

router.post(
  '/geo-fencing/deleteAttendanceSite',
  geoFencingController.deleteAttendanceSite.bind(geoFencingController)
);

export default router;
