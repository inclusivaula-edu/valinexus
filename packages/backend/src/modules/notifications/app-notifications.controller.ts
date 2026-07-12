import { Request, Response, NextFunction } from 'express';
import { appNotificationsService } from '../../utils/app-notifications.service';

export const appNotificationsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const notifications = await appNotificationsService.listAll(req.user!.userId);
      const unreadCount = await appNotificationsService.countUnread(req.user!.userId);
      res.json({ success: true, data: { notifications, unreadCount } });
    } catch (err) {
      next(err);
    }
  },

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await appNotificationsService.markAsRead(req.params.id, req.user!.userId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await appNotificationsService.markAllAsRead(req.user!.userId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async unreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await appNotificationsService.countUnread(req.user!.userId);
      res.json({ success: true, data: { count } });
    } catch (err) {
      next(err);
    }
  },
};
