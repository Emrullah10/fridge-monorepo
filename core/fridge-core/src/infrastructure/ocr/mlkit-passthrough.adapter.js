// Mobil (Flutter ML Kit) zaten metni çıkardıysa kullanılır — kademe 1'i atlar.
const makeMlkitPassthroughOcr = () => {
  return {
    extractText: async ({ rawText }) => ({ rawText, provider: 'mlkit-mobile' }),
  };
};

export { makeMlkitPassthroughOcr };
