import { Router } from 'express';
import { appNotificationsController } from './app-notifications.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();
router.use(authenticate);

router.get('/', appNotificationsController.list);
router.get('/unread-count', appNotificationsController.unreadCount);
router.post('/mark-all-read', appNotificationsController.markAllAsRead);
router.post('/:id/read', appNotificationsController.markAsRead);

export { router as appNotificationsRouter };
