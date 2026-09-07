import { Router } from 'express';
import geoFencingController from '../../../modules/geo-fencing/controllers/geo-fencing.controller';

const router = Router();

router.post(
  '/geo-fencing/createAttendanceLocation',
  geoFencingController.createAttendanceLocation.bind(geoFencingController)
);
router.post(
  '/geo-fencing/getAttendanceLocations',
  geoFencingController.getAttendanceLocations.bind(geoFencingController)
);
router.post(
  '/geo-fencing/updateAttendanceLocation',
  geoFencingController.updateAttendanceLocation.bind(geoFencingController)
);

router.post(
  '/geo-fencing/getAttendanceLocationById',
  geoFencingController.getAttendanceLocationById.bind(geoFencingController)
);

router.post(
  '/geo-fencing/deleteAttendanceLocation',
  geoFencingController.deleteAttendanceLocation.bind(geoFencingController)
);

export default router;
