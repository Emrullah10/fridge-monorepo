import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth } from '@fridge/middlewares';

const buildInviteRouter = ({ container }) => {
  const router = Router();
  const { useCases } = container;

  // Misafir davet kabul EDEMEZ (plan §Faz 2) — premium bir alana bedavadan
  // binmesin, 30 günde purge edilen anonim bir hesap paylaşımlı veriye
  // sahip olmasın (purge-stale-guests.js). Üye sayısı sınırı (sahibin
  // planına göre) acceptInvite use-case'inin İÇİNDE, aynı transaction'da
  // kontrol edilir (bkz. accept-invite.use-case.js) — burada değil, çünkü
  // householdId (invite kodundan) ve race condition koruması sadece orada
  // güvenli.
  router.post('/:code/accept', requireAuth(), asyncHandler(async (req, res) => {
    if (req.user.isGuest) {
      return res.status(402).json({
        error: { code: 'SIGNUP_REQUIRED', message: 'Bir alana katılmak için ücretsiz hesap açman gerekiyor.' },
        feature: 'member.perHousehold',
      });
    }

    const result = await useCases.acceptInvite({ code: req.params.code, userId: req.user.id });
    res.json(result);
  }));

  return router;
};

export { buildInviteRouter };
