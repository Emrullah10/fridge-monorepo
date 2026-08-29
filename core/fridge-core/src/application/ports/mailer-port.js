// sendPasswordResetCode({ to, displayName, code, ttlMinutes }) -> Promise<void>
//
// to: alıcı e-posta
// displayName: kullanıcı adı (e-posta gövdesinde selamlama için)
// code: 6 haneli düz metin kod (adaptör gövdeye gömer, ASLA loglanmamalı
//   dışında bir yerde saklanmamalı — DB'ye sadece hash'i yazılır)
// ttlMinutes: kodun geçerlilik süresi (dakika) — gövdede kullanıcıya gösterilir
//
// Hata fırlatabilir (ağ/API hatası) — çağıran taraf (request-password-reset
// use-case) bunu yutup akışı yine başarıyla bitirmekle yükümlü: e-posta
// gönderiminin başarısız olması, kullanıcıya "böyle bir hesap var/yok"
// bilgisini sızdırmamalı.
export {};
