import { Router } from 'express';
import teamController from '../../../modules/admin/controllers/team.controller';
import ruleController from '../../../modules/admin/controllers/team-assignment-rule.controller';

const router = Router();

router.post('/create', teamController.create);
router.post('/list', teamController.list);
router.post('/detail', teamController.detail);
router.post('/update', teamController.update);
router.post('/delete', teamController.remove);
router.post('/members/list', teamController.listMembers);
router.post('/members/add', teamController.addMember);
router.post('/members/update', teamController.updateMember);
router.post('/members/remove', teamController.removeMember);
router.post('/assignment-rules/create', ruleController.create);
router.post('/assignment-rules/list', ruleController.list);
router.post('/assignment-rules/update', ruleController.update);
router.post('/assignment-rules/delete', ruleController.remove);

export default router;
