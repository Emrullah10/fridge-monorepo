import { buildPasswordResetEmail } from './password-reset-email.js';

// Resend REST API — https://resend.com/docs/api-reference/emails/send-email
// Ek bağımlılık eklemeden düz fetch (openfoodfacts.adapter.js deseni).
const makeResendMailer = ({ apiKey, from, fetchFn = fetch }) => {
  return {
    sendPasswordResetCode: async ({ to, displayName, code, ttlMinutes }) => {
      const { subject, text, html } = buildPasswordResetEmail({ displayName, code, ttlMinutes });

      const res = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to, subject, text, html }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Resend gönderim hatası: ${res.status} ${body}`);
      }
    },
  };
};

export { makeResendMailer };
