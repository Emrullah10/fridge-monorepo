/**
 * @typedef {Object} ParsedLineItem
 * @property {number} lineNo
 * @property {string} rawText
 * @property {string} parsedName
 * @property {number} parsedQuantity
 * @property {string} parsedUnit
 * @property {number} [parsedPrice]
 *
 * @typedef {Object} ReceiptParserPort
 * @property {(input: { rawText: string }) => Promise<{ lineItems: ParsedLineItem[], merchantName: string|null, purchasedAt: string|null, totalAmount: number|null, provider: string, model: string }>} parse
 */

export {};
