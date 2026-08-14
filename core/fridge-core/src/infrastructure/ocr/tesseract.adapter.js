import { createWorker } from 'tesseract.js';

// Kademe 1: belge tarama. Deterministik, bedava, Ollama'ya bağımlı değil.
const makeTesseractOcr = ({ storagePort }) => {
  return {
    extractText: async ({ imagePath }) => {
      const buffer = await storagePort.read({ path: imagePath });
      const worker = await createWorker('tur+eng');
      try {
        const { data } = await worker.recognize(buffer);
        return { rawText: data.text.trim(), provider: 'tesseract' };
      } finally {
        await worker.terminate();
      }
    },
  };
};

export { makeTesseractOcr };
