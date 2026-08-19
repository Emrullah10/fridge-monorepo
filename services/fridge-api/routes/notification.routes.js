import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth } from '@fridge/middlewares';
import { ValidationError } from '@fridge/errors';

const ALLOWED_PLATFORMS = ['android', 'ios', 'web'];

const buildDeviceRouter = ({ container }) => {
  const router = Router();
  const { repos } = container;

  router.use(requireAuth());

  router.post('/', asyncHandler(async (req, res) => {
    const { token, platform = 'android', deviceId, locale } = req.body;
    if (typeof token !== 'string' || token.length === 0 || token.length > 4096) {
      throw new ValidationError('Geçersiz cihaz token değeri');
    }
    if (!ALLOWED_PLATFORMS.includes(platform)) {
      throw new ValidationError('Geçersiz platform');
    }
    const device = await repos.deviceTokenRepo.upsert({
      userId: req.user.id,
      token,
      platform,
      deviceId: deviceId ?? null,
      locale: locale ?? 'tr',
    });
    // token'ı yanıtta geri yankılamıyoruz — istemci zaten biliyor, log/response'ta gereksiz.
    res.status(201).json({ device: { id: device.id, platform: device.platform } });
  }));

  router.delete('/:token', asyncHandler(async (req, res) => {
    await repos.deviceTokenRepo.deleteByToken({ userId: req.user.id, token: req.params.token });
    res.status(204).end();
  }));

  return router;
};

const buildNotificationRouter = ({ container }) => {
  const router = Router();
  const { repos } = container;

  router.use(requireAuth());

  router.get('/', asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 30;
    const before = req.query.before ? new Date(req.query.before) : undefined;
    const [notifications, unreadCount] = await Promise.all([
      repos.notificationRepo.listByUser(req.user.id, { limit, before }),
      repos.notificationRepo.countUnread(req.user.id),
    ]);
    res.json({ notifications, unreadCount });
  }));

  router.post('/read', asyncHandler(async (req, res) => {
    await repos.notificationRepo.markRead({ userId: req.user.id, ids: req.body.ids });
    const unreadCount = await repos.notificationRepo.countUnread(req.user.id);
    res.json({ unreadCount });
  }));

  router.get('/preferences', asyncHandler(async (req, res) => {
    const preferences = await repos.notificationPreferenceRepo.listByUser(req.user.id);
    res.json({ preferences });
  }));

  router.patch('/preferences/:type', asyncHandler(async (req, res) => {
    if (typeof req.body.pushEnabled !== 'boolean') {
      throw new ValidationError('pushEnabled boolean olmalı');
    }
    const preference = await repos.notificationPreferenceRepo.upsert({
      userId: req.user.id,
      type: req.params.type,
      pushEnabled: req.body.pushEnabled,
    });
    res.json({ preference });
  }));

  return router;
};

export { buildDeviceRouter, buildNotificationRouter };
