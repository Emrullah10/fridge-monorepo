/**
 * Push bildirimi göndermek için port. Diğer portlarla aynı stil: sıfır
 * runtime kod, sadece JSDoc typedef — implementasyon infrastructure/notification'da.
 *
 * @typedef {Object} PushResult
 * @property {number} successCount
 * @property {string[]} invalidTokens - UNREGISTERED / INVALID_ARGUMENT hatası
 *   alan token'lar. Port bunları SİLMEZ, sadece raporlar — silme sorumluluğu
 *   çağıran use-case'te (persistence'tan bağımsız kalması için).
 *
 * @typedef {Object} NotificationPort
 * @property {(input: { tokens: string[], title: string, body: string, data?: Record<string,string> }) => Promise<PushResult>} sendToTokens
 */
export {};
