// RESEND_API_KEY yoksa (dev ortamı ya da henüz kurulmamışsa) container bu
// adaptöre düşer — fcm no-op adaptöründeki ilke aynen geçerli: mail
// altyapısının yokluğu hiçbir isteği asla 500'e düşürmemeli. Kod, dev'de
// gözlemlenebilsin diye konsola basılır.
const makeNoopMailer = ({ logger = console } = {}) => {
  return {
    sendPasswordResetCode: async ({ to, code, ttlMinutes }) => {
      logger.warn(
        `[mailer:noop] RESEND_API_KEY tanımlı değil — kod gönderilmedi. ` +
        `to=${to} code=${code} ttlMinutes=${ttlMinutes}`,
      );
    },
  };
};

export { makeNoopMailer };
