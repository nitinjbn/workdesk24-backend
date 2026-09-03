import { Router } from 'express';
import geoFencingController from '../../../modules/geo-fencing/controllers/geo-fencing.controller';

const router = Router();

router.post('/geo-fencing/createAttendanceLocation', geoFencingController.createAttendanceLocation.bind(geoFencingController));
router.post('/geo-fencing/getAttendanceLocations', geoFencingController.getAttendanceLocations.bind(geoFencingController));
router.post('/geo-fencing/updateAttendanceLocation', geoFencingController.updateAttendanceLocation.bind(geoFencingController));

export default router;
