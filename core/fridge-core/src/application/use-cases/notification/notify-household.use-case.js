import { log } from '@fridge/helper';
import { NOTIFICATION_TEMPLATES } from '../../../domain/notification-types.js';

// Her gelecek bildirim tipinin çağıracağı TEK fan-out motoru. Yeni bir
// bildirim eklemek notification-types.js'e şablon eklemek ve buradan
// çağırmaktan ibarettir — bu dosyaya dokunmaya gerek yok.
//
// KRİTİK: tüm gövde try/catch ile sarılı ve ASLA rethrow etmiyor. Ölü bir
// FCM bağlantısı ya da ağ hatası, çağıran use-case'in (örn. accept-invite)
// başarılı işlemini 500'e çeviremez — bildirim best-effort'tur.
const makeNotifyHousehold = ({
  householdMemberRepo,
  deviceTokenRepo,
  notificationRepo,
  notificationPreferenceRepo,
  notificationPort,
}) => {
  return async ({ householdId, type, excludeUserId, context, dedupeKey }) => {
    try {
      const template = NOTIFICATION_TEMPLATES[type];
      if (!template) {
        log.error('notify_household_unknown_type', { type });
        return { notifiedUserIds: [] };
      }

      const members = await householdMemberRepo.listMembers(householdId);
      const targetUserIds = members
        .map((m) => m.userId)
        .filter((userId) => userId !== excludeUserId);

      if (targetUserIds.length === 0) {
        return { notifiedUserIds: [] };
      }

      const enabledUserIds = await notificationPreferenceRepo.filterEnabledUserIds({
        userIds: targetUserIds,
        type,
      });
      if (enabledUserIds.length === 0) {
        return { notifiedUserIds: [] };
      }

      const { title, body, data } = template.build(context);

      // Uygulama içi liste/rozet ÖNCE yazılır — push başarısız olsa bile
      // kullanıcı bir sonraki açılışta bildirimi görsün diye.
      await notificationRepo.createMany(
        enabledUserIds.map((userId) => ({
          userId,
          householdId,
          type,
          title,
          body,
          data,
          dedupeKey: dedupeKey ? `${dedupeKey}:${userId}` : null,
        })),
      );

      const deviceTokens = await deviceTokenRepo.listByUserIds(enabledUserIds);
      const tokens = deviceTokens.map((d) => d.token);

      const { invalidTokens } = await notificationPort.sendToTokens({ tokens, title, body, data });
      if (invalidTokens.length > 0) {
        await deviceTokenRepo.deleteByTokens(invalidTokens);
      }

      return { notifiedUserIds: enabledUserIds };
    } catch (error) {
      log.error('notify_household_failed', { message: error.message, householdId, type });
      return { notifiedUserIds: [] };
    }
  };
};

export { makeNotifyHousehold };
