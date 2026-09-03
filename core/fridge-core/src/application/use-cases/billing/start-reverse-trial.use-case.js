const TRIAL_DAYS = 14;

// register-user.use-case.js VE upgrade-guest-user.use-case.js'in her ikisi
// de bu use-case'i çağırır (bkz. plan §Faz 3 "Tetiklenme"). Suistimal
// koruması: aynı cihaz (deviceId — misafirin guest_device_id'si veya daha
// önceki bir trial_device_id) daha önce deneme aldıysa YENİ bir deneme
// VERİLMEZ, ama bu SESSİZCE olur — kullanıcıya hata gösterilmez (yanlış
// pozitifte kullanıcıyı suçlamış olmayalım, ör. paylaşımlı cihaz/emülatör
// sıfırlama senaryoları). deviceId hiç yoksa (web/eski istemci) deneme
// verilir — cihaz kimliği zorunlu değil, sadece varsa kullanılır.
const makeStartReverseTrial = ({ userRepo, clock }) => {
  return async ({ userId, deviceId = null }) => {
    if (deviceId) {
      const priorTrialUser = await userRepo.findTrialByDeviceId(deviceId);
      // Kendi hesabı hariç (misafirken zaten guest_device_id kendi hesabında
      // duruyor, bu bir "önceki kullanım" sayılmaz).
      if (priorTrialUser && priorTrialUser.id !== userId) {
        return { started: false, reason: 'DEVICE_ALREADY_USED_TRIAL' };
      }
    }

    const startedAt = clock.now();
    const endsAt = new Date(startedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    await userRepo.startTrial(userId, { startedAt, endsAt, deviceId });

    return { started: true, trialEndsAt: endsAt };
  };
};

export { makeStartReverseTrial, TRIAL_DAYS };
