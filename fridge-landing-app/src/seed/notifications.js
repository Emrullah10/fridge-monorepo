/**
 * @typedef {Object} AppNotification
 * @property {string} id
 * @property {string} title
 * @property {string} body
 * @property {string} createdAt
 * @property {boolean} isRead
 * @property {'expiry'|'member'|'receipt'|'system'} kind
 */

function hoursAgo(h) {
  const d = new Date();
  d.setHours(d.getHours() - h);
  return d.toISOString();
}

/** @type {AppNotification[]} — 7 bildirim (3 okunmamış) */
export const notifications = [
  {
    id: 'n-1',
    title: 'Beyaz Peynir\'in SKT\'si geçti',
    body: 'Buzdolabındaki Pınar Beyaz Peynir\'in son kullanma tarihi geçti.',
    createdAt: hoursAgo(2),
    isRead: false,
    kind: 'expiry',
  },
  {
    id: 'n-2',
    title: 'Fiş hazır',
    body: 'MİGROS fişin analiz edildi, 6 ürün onayını bekliyor.',
    createdAt: hoursAgo(5),
    isRead: false,
    kind: 'receipt',
  },
  {
    id: 'n-3',
    title: 'Deniz eve katıldı',
    body: 'Deniz, "Kalender Evi"ne davet koduyla katıldı.',
    createdAt: hoursAgo(30),
    isRead: false,
    kind: 'member',
  },
  {
    id: 'n-4',
    title: 'Yoğurt\'un SKT\'si yaklaşıyor',
    body: 'Danone Yoğurt 2 gün içinde son kullanma tarihine ulaşacak.',
    createdAt: hoursAgo(36),
    isRead: true,
    kind: 'expiry',
  },
  {
    id: 'n-5',
    title: 'Salatalık\'ın SKT\'si yaklaşıyor',
    body: 'Salatalık yarın son kullanma tarihine ulaşacak.',
    createdAt: hoursAgo(48),
    isRead: true,
    kind: 'expiry',
  },
  {
    id: 'n-6',
    title: 'Aylık özet hazır',
    body: 'Ağustos ayında 842,50₺ biriktirdin, 156,30₺ israf ettin.',
    createdAt: hoursAgo(72),
    isRead: true,
    kind: 'system',
  },
  {
    id: 'n-7',
    title: 'Fiş onaylandı',
    body: '5 ürün envanterine eklendi.',
    createdAt: hoursAgo(96),
    isRead: true,
    kind: 'receipt',
  },
];

/** @type {AppNotification[]} */
export const emptyNotifications = [];
