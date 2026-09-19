// RESEND_API_KEY yoksa (dev ortamı ya da henüz kurulmamışsa) container bu
// adaptöre düşer — fcm no-op adaptöründeki ilke aynen geçerli: mail
// altyapısının yokluğu hiçbir isteği asla 500'e düşürmemeli. Kod, YALNIZCA
// dev'de gözlemlenebilsin diye konsola basılır.
//
// GÜVENLİK: bu kod düz metin şifre sıfırlama kodu içerir — RESEND_API_KEY'i
// unutan/kaybeden bir prod deploy'un hesap ele geçirme kodlarını sessizce
// log toplayıcıya basmaması için NODE_ENV kontrolü burada AYRICA yapılır
// (RESEND_API_KEY bilinçli olarak REQUIRED_IN_PRODUCTION_KEYS'e alınmadı —
// bkz. config/src/index.js — çünkü şifremi unuttum'un yokluğu boot'u
// patlatmamalı; ama prod'da kodun loglanması da kabul edilemez).
const makeNoopMailer = ({ logger = console, nodeEnv = process.env.NODE_ENV } = {}) => {
  // Kara liste değil AK LİSTE: yalnızca nodeEnv tam olarak 'development'
  // ise kod loglanır. Böylece staging/typo'lu bir NODE_ENV/tanımsız bir
  // env değişkeni de varsayılan olarak GÜVENLİ tarafta kalır — production
  // guard'ının aksine (REQUIRED_IN_PRODUCTION_KEYS 'production' ile tam
  // eşleşmeyi bekliyor, bkz. config/src/index.js), burada belirsizlik
  // durumunda kod BASILMAZ.
  const isDevelopment = nodeEnv === 'development';

  return {
    sendPasswordResetCode: async ({ to, code, ttlMinutes }) => {
      if (!isDevelopment) {
        logger.error(
          '[mailer:noop] RESEND_API_KEY tanımlı değil — sıfırlama kodu gönderilemedi ' +
          '(kod güvenlik nedeniyle loglanmadı). Şifremi unuttum akışı bu kullanıcı için ÇALIŞMIYOR.',
        );
        return;
      }
      logger.warn(
        `[mailer:noop] RESEND_API_KEY tanımlı değil — kod gönderilmedi. ` +
        `to=${to} code=${code} ttlMinutes=${ttlMinutes}`,
      );
    },
  };
};

export { makeNoopMailer };
