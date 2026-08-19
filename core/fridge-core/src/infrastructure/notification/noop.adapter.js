import { log } from '@fridge/helper';

// FCM_ENABLED=false veya kimlik bilgisi eksikse devreye girer. Push'un
// yokluğu hiçbir zaman bir isteği 500'e düşürmemeli — bu yüzden başarısızlık
// değil, "0 gönderildi" döner.
const makeNoopNotifier = () => {
  let warned = false;
  return {
    sendToTokens: async ({ tokens }) => {
      if (!warned) {
        warned = true;
        log.warn('fcm_disabled', { message: 'Push bildirimleri devre dışı (FCM_ENABLED=false veya kimlik bilgisi eksik)' });
      }
      return { successCount: 0, invalidTokens: [] };
    },
  };
};

export { makeNoopNotifier };
