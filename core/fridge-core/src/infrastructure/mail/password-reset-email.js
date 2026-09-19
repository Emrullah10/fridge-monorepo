// Şifre sıfırlama e-postasının Türkçe HTML + düz metin gövdesi.
// resend.adapter.js ve gelecekte eklenebilecek başka mail adaptörleri
// aynı gövdeyi paylaşsın diye adaptörden ayrı tutuldu.

// displayName kayıt sırasında kullanıcının kendisi tarafından serbestçe
// girilir (assertValidRegisterInput yalnızca boş olmadığını kontrol eder,
// bkz. auth.routes.js) — HTML'e escape edilmeden basılıyordu. Bu e-posta
// yalnızca hesap sahibinin kendi adresine gittiği için pratikte self-XSS'ten
// öteye geçmiyordu, ama gelecekte bu şablon başka bir alıcıya (ör. davet
// e-postası) uyarlanırsa aynı escape eksikliği tam bir phishing/HTML
// injection primitifine dönüşür — o yüzden burada düzeltilir.
const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const buildPasswordResetEmail = ({ displayName, code, ttlMinutes }) => {
  const subject = 'Fridge — Şifre sıfırlama kodun';
  const safeDisplayName = escapeHtml(displayName);

  const text = `Merhaba ${displayName},

Şifreni sıfırlamak için aşağıdaki kodu kullan:

${code}

Bu kod ${ttlMinutes} dakika boyunca geçerli. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.

— Fridge`;

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #096444; margin-bottom: 8px;">Şifre sıfırlama</h2>
      <p>Merhaba ${safeDisplayName},</p>
      <p>Şifreni sıfırlamak için aşağıdaki kodu kullan:</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; background: #f0f5f2; color: #096444; padding: 16px; border-radius: 12px; margin: 24px 0;">
        ${code}
      </div>
      <p style="color: #667;">Bu kod <strong>${ttlMinutes} dakika</strong> boyunca geçerli. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>
      <p style="color: #99a;">— Fridge</p>
    </div>
  `.trim();

  return { subject, text, html };
};

export { buildPasswordResetEmail };
