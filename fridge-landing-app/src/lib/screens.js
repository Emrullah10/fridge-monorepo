// 23 ekranın metadata registry'si. Astro bileşenleri build-time statik import
// gerektirdiği için gerçek component referansları src/pages/ekranlar.astro'da
// elle import edilir; bu dosya sadece sıra/başlık/kaynak/destekli özellik bilgisini tutar.

/**
 * @typedef {Object} ScreenMeta
 * @property {string} key
 * @property {string} titleTr
 * @property {string} titleEn
 * @property {string} sourceFile
 * @property {boolean} [supportsEmptyMode]
 * @property {boolean} [supportsPeriod]
 * @property {string} group
 */

/** @type {ScreenMeta[]} */
export const screens = [
  { key: 'welcome', titleTr: 'Karşılama', titleEn: 'Welcome', sourceFile: 'auth/welcome_screen.dart', group: 'identity' },
  { key: 'intro', titleTr: 'Tanıtım', titleEn: 'Intro', sourceFile: 'onboarding/intro_screen.dart', group: 'identity' },
  { key: 'login', titleTr: 'Giriş', titleEn: 'Login', sourceFile: 'auth/login_screen.dart', group: 'identity' },
  { key: 'register', titleTr: 'Kayıt', titleEn: 'Register', sourceFile: 'auth/register_screen.dart', group: 'identity' },
  { key: 'upgrade-account', titleTr: 'Hesaba Yükselt', titleEn: 'Upgrade account', sourceFile: 'auth/upgrade_account_screen.dart', group: 'identity' },
  { key: 'household-list', titleTr: 'Alanlarım', titleEn: 'My spaces', sourceFile: 'household/household_list_screen.dart', supportsEmptyMode: true, group: 'household' },
  { key: 'household-home', titleTr: 'Ev Ana Ekranı', titleEn: 'Household home', sourceFile: 'household/household_home_screen.dart', group: 'household' },
  { key: 'household-members', titleTr: 'Üyeler', titleEn: 'Members', sourceFile: 'household/household_members_screen.dart', group: 'household' },
  { key: 'inventory', titleTr: 'Envanter', titleEn: 'Inventory', sourceFile: 'inventory/inventory_screen.dart', supportsEmptyMode: true, group: 'household' },
  { key: 'add-inventory-item', titleTr: 'Dolaba Ekle', titleEn: 'Add to inventory', sourceFile: 'inventory/add_inventory_item_screen.dart', group: 'household' },
  { key: 'barcode-scan', titleTr: 'Barkod Tara', titleEn: 'Scan barcode', sourceFile: 'inventory/barcode_scan_screen.dart', group: 'household' },
  { key: 'receipt-scan', titleTr: 'Fiş Tara', titleEn: 'Scan receipt', sourceFile: 'receipt/receipt_scan_screen.dart', group: 'receipt' },
  { key: 'receipt-review', titleTr: 'Fiş Onayla', titleEn: 'Review receipt', sourceFile: 'receipt/receipt_review_screen.dart', group: 'receipt' },
  { key: 'receipt-history', titleTr: 'Fiş Geçmişi', titleEn: 'Receipt history', sourceFile: 'receipt/receipt_history_screen.dart', supportsEmptyMode: true, group: 'receipt' },
  { key: 'shopping-list', titleTr: 'Alışveriş Listesi', titleEn: 'Shopping list', sourceFile: 'shopping/shopping_list_screen.dart', supportsEmptyMode: true, group: 'shopping' },
  { key: 'recipes', titleTr: 'Tarifler', titleEn: 'Recipes', sourceFile: 'recipe/recipes_screen.dart', group: 'shopping' },
  { key: 'recipe-detail', titleTr: 'Tarif Detayı', titleEn: 'Recipe detail', sourceFile: 'recipe/recipe_detail_screen.dart', group: 'shopping' },
  { key: 'recipe-step', titleTr: 'Tarif Adımı', titleEn: 'Recipe step', sourceFile: 'recipe/recipe_step_screen.dart', group: 'shopping' },
  { key: 'chef-chat', titleTr: 'AI Şef', titleEn: 'AI Chef', sourceFile: 'chef/chef_chat_screen.dart', group: 'shopping' },
  { key: 'insights', titleTr: 'Para & İsraf', titleEn: 'Money & waste', sourceFile: 'insights/insights_screen.dart', supportsEmptyMode: true, supportsPeriod: true, group: 'money' },
  { key: 'notifications', titleTr: 'Bildirimler', titleEn: 'Notifications', sourceFile: 'notification/notifications_screen.dart', supportsEmptyMode: true, group: 'money' },
  { key: 'settings', titleTr: 'Ayarlar', titleEn: 'Settings', sourceFile: 'settings/settings_screen.dart', group: 'money' },
  { key: 'diet-profile', titleTr: 'Diyet Profili', titleEn: 'Diet profile', sourceFile: 'settings/diet_profile_screen.dart', group: 'money' },
];

export const groupLabels = {
  identity: { tr: 'Kimlik', en: 'Identity' },
  household: { tr: 'Ev & Envanter', en: 'Household & inventory' },
  receipt: { tr: 'Fiş', en: 'Receipt' },
  shopping: { tr: 'Alışveriş, Tarif & Şef', en: 'Shopping, recipes & chef' },
  money: { tr: 'Para & Ayarlar', en: 'Money & settings' },
};
