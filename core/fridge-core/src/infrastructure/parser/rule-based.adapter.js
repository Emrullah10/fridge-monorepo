// Ollama kapalıyken kullanılan basit fallback: her satırı ham haliyle,
// miktar/birim tahmini yapmadan tek kalem olarak döner. Kullanıcı elle düzeltir.
const makeRuleBasedParser = () => {
  return {
    parse: async ({ rawText }) => {
      const lines = rawText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      return {
        lineItems: lines.map((line, index) => ({
          lineNo: index + 1,
          rawText: line,
          parsedName: line,
          parsedQuantity: 1,
          parsedUnit: 'piece',
          parsedPrice: null,
        })),
        merchantName: null,
        purchasedAt: null,
        totalAmount: null,
        provider: 'rule-based',
        model: 'none',
      };
    },
  };
};

export { makeRuleBasedParser };
