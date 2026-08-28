/**
 * @typedef {Object} CategoryBreakdown
 * @property {string} categoryKey
 * @property {number} saved
 * @property {number} wasted
 * @typedef {Object} MemberBreakdown
 * @property {string} userId
 * @property {string|null} displayName
 * @property {number} saved
 * @property {number} wasted
 * @typedef {Object} TopWastedItem
 * @property {string|null} productName
 * @property {string|null} productBrand
 * @property {number} wasted
 * @property {number} quantity
 * @typedef {Object} InsightsPeriod
 * @property {'this-month'|'last-month'|'90-days'} key
 * @property {string} label
 * @property {string} from
 * @property {string} to
 * @typedef {Object} Insights
 * @property {InsightsPeriod} period
 * @property {number} saved
 * @property {number} wasted
 * @property {number} spent
 * @property {number} missingPriceCount
 * @property {CategoryBreakdown[]} byCategory
 * @property {MemberBreakdown[]} byMember
 * @property {TopWastedItem[]} topWasted
 */

/** @type {Insights[]} — 3 dönem × tam metrik seti */
export const insights = [
  {
    period: { key: 'this-month', label: 'Bu ay', from: '2026-08-01', to: '2026-09-01' },
    saved: 842.5,
    wasted: 156.3,
    spent: 2140.75,
    missingPriceCount: 3,
    byCategory: [
      { categoryKey: 'dairy', saved: 210.4, wasted: 42.0 },
      { categoryKey: 'produce', saved: 180.2, wasted: 68.5 },
      { categoryKey: 'meat', saved: 260.0, wasted: 25.8 },
      { categoryKey: 'pantry', saved: 120.9, wasted: 12.0 },
      { categoryKey: 'beverages', saved: 71.0, wasted: 8.0 },
    ],
    byMember: [
      { userId: 'u-1', displayName: 'Elif', saved: 480.5, wasted: 90.0 },
      { userId: 'u-2', displayName: 'Deniz', saved: 362.0, wasted: 66.3 },
    ],
    topWasted: [
      { productName: 'Beyaz Peynir', productBrand: 'Pınar', wasted: 89.0, quantity: 1 },
      { productName: 'Marul', productBrand: null, wasted: 14.9, quantity: 1 },
      { productName: 'Zeytin', productBrand: 'Marmarabirlik', wasted: 54.9, quantity: 1 },
    ],
  },
  {
    period: { key: 'last-month', label: 'Geçen ay', from: '2026-07-01', to: '2026-08-01' },
    saved: 715.0,
    wasted: 203.4,
    spent: 1980.0,
    missingPriceCount: 5,
    byCategory: [
      { categoryKey: 'dairy', saved: 180.0, wasted: 55.0 },
      { categoryKey: 'produce', saved: 150.0, wasted: 90.4 },
      { categoryKey: 'meat', saved: 220.0, wasted: 40.0 },
      { categoryKey: 'pantry', saved: 110.0, wasted: 10.0 },
      { categoryKey: 'beverages', saved: 55.0, wasted: 8.0 },
    ],
    byMember: [
      { userId: 'u-1', displayName: 'Elif', saved: 400.0, wasted: 120.0 },
      { userId: 'u-2', displayName: 'Deniz', saved: 315.0, wasted: 83.4 },
    ],
    topWasted: [
      { productName: 'Tavuk Göğsü', productBrand: 'Banvit', wasted: 95.0, quantity: 0.5 },
      { productName: 'Domates', productBrand: null, wasted: 42.0, quantity: 1.5 },
      { productName: 'Yoğurt', productBrand: 'Danone', wasted: 30.0, quantity: 1 },
    ],
  },
  {
    period: { key: '90-days', label: 'Son 90 gün', from: '2026-06-01', to: '2026-09-01' },
    saved: 2380.9,
    wasted: 512.7,
    spent: 6120.5,
    missingPriceCount: 11,
    byCategory: [
      { categoryKey: 'dairy', saved: 590.0, wasted: 140.0 },
      { categoryKey: 'produce', saved: 480.0, wasted: 210.0 },
      { categoryKey: 'meat', saved: 720.0, wasted: 95.0 },
      { categoryKey: 'pantry', saved: 380.0, wasted: 45.0 },
      { categoryKey: 'beverages', saved: 210.9, wasted: 22.7 },
    ],
    byMember: [
      { userId: 'u-1', displayName: 'Elif', saved: 1320.0, wasted: 290.0 },
      { userId: 'u-2', displayName: 'Deniz', saved: 1060.9, wasted: 222.7 },
    ],
    topWasted: [
      { productName: 'Tavuk Göğsü', productBrand: 'Banvit', wasted: 189.9, quantity: 1 },
      { productName: 'Beyaz Peynir', productBrand: 'Pınar', wasted: 89.0, quantity: 1 },
      { productName: 'Zeytin', productBrand: 'Marmarabirlik', wasted: 54.9, quantity: 1 },
      { productName: 'Domates', productBrand: null, wasted: 48.5, quantity: 2.2 },
      { productName: 'Marul', productBrand: null, wasted: 29.8, quantity: 2 },
    ],
  },
];

/** @type {Insights[]} — "empty" mod ikizi: hiç hareket yok */
export const emptyInsights = insights.map((i) => ({
  ...i,
  saved: 0,
  wasted: 0,
  spent: 0,
  missingPriceCount: 0,
  byCategory: [],
  byMember: [],
  topWasted: [],
}));
