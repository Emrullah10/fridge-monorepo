// Ollama'nın JSON Schema formatı (`type: ['string','null']` union, iç içe
// `properties`) Gemini'nin `responseSchema` alanıyla neredeyse aynı, iki
// fark var: (1) `type` değerleri büyük harf enum'dur ("OBJECT"/"ARRAY"/
// "STRING"/"NUMBER"), (2) null'a izin veren alanlar union yerine ayrı bir
// `nullable: true` bayrağı kullanır. Fiş ayrıştırma (gemini-text.adapter.js)
// ve tarif üretimi (gemini-recipe.adapter.js) aynı çeviriye ihtiyaç duyduğu
// için burada paylaşılıyor — tek kaynaktan iki kez yazmak yerine.
const toGeminiType = (type) => {
  if (Array.isArray(type)) {
    const nonNull = type.find((t) => t !== 'null');
    return { type: toGeminiType(nonNull).type, nullable: type.includes('null') };
  }
  const map = { object: 'OBJECT', array: 'ARRAY', string: 'STRING', number: 'NUMBER', boolean: 'BOOLEAN' };
  return { type: map[type] ?? 'STRING' };
};

const toGeminiSchema = (schema) => {
  const { type, nullable } = toGeminiType(schema.type);
  const result = { type, ...(nullable ? { nullable: true } : {}) };

  if (schema.enum) result.enum = schema.enum.filter((value) => value !== null);
  if (schema.required) result.required = schema.required;
  if (schema.properties) {
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [key, toGeminiSchema(value)]),
    );
  }
  if (schema.items) result.items = toGeminiSchema(schema.items);

  return result;
};

export { toGeminiType, toGeminiSchema };
