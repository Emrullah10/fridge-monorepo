// Her yeni bildirim tipi YALNIZCA buraya eklenir — fan-out motoru
// (notify-household.use-case.js) ve tercih sistemi bu registry'i okur,
// başka hiçbir yer değişmez.
const NOTIFICATION_TYPES = {
  MEMBER_JOINED: 'member_joined',
  ITEM_EXPIRING: 'item_expiring',
  RECEIPT_PROCESSED: 'receipt_processed',
  ITEM_CONSUMED: 'item_consumed',
};

// type -> { defaultEnabled, build(ctx) -> {title, body, data} }
// data'daki tüm değerler STRING olmalı — FCM data payload'ı string bekler,
// aksi halde adaptör tüm batch'i reddeder (bkz. fcm.adapter.js).
const NOTIFICATION_TEMPLATES = {
  [NOTIFICATION_TYPES.MEMBER_JOINED]: {
    defaultEnabled: true,
    build: ({ actorName, householdName, householdId }) => ({
      title: householdName,
      body: `${actorName} alanına katıldı`,
      data: { type: NOTIFICATION_TYPES.MEMBER_JOINED, householdId },
    }),
  },
  [NOTIFICATION_TYPES.ITEM_EXPIRING]: {
    defaultEnabled: true,
    build: ({ productName, householdId }) => ({
      title: 'Son kullanma tarihi yaklaşıyor',
      body: `${productName} yakında son kullanma tarihine ulaşıyor`,
      data: { type: NOTIFICATION_TYPES.ITEM_EXPIRING, householdId },
    }),
  },
  [NOTIFICATION_TYPES.RECEIPT_PROCESSED]: {
    defaultEnabled: true,
    build: ({ householdId, scanId }) => ({
      title: 'Fiş hazır',
      body: 'Taradığın fiş işlendi, incelemek için dokun',
      data: { type: NOTIFICATION_TYPES.RECEIPT_PROCESSED, householdId, scanId },
    }),
  },
  [NOTIFICATION_TYPES.ITEM_CONSUMED]: {
    defaultEnabled: true,
    build: ({ actorName, productName, householdId }) => ({
      title: 'Envanter güncellendi',
      body: `${actorName}, ${productName} ürününü tüketti`,
      data: { type: NOTIFICATION_TYPES.ITEM_CONSUMED, householdId },
    }),
  },
};

export { NOTIFICATION_TYPES, NOTIFICATION_TEMPLATES };
