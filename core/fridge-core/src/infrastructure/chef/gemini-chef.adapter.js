import { toGeminiSchema } from '../gemini/gemini-schema.js';
import { CHEF_RESPONSE_SCHEMA, SYSTEM_PROMPT, buildKitchenContext } from './chef-prompt.js';

const GEMINI_CHEF_SCHEMA = toGeminiSchema(CHEF_RESPONSE_SCHEMA);

// chef-chat-port.js sözleşmesini uygular. gemini-recipe.adapter.js ile aynı
// REST çağrı şekli; fark: mutfak bağlamı ilk user turn'ünden önce ayrı bir
// "context" mesajı olarak veriliyor, sonra gerçek sohbet geçmişi ekleniyor.
const makeGeminiChefChat = ({ apiKey, model, fetchFn = fetch }) => {
  return {
    reply: async ({ history, kitchen }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);

      const contents = [
        { role: 'user', parts: [{ text: `MUTFAK DURUMU:\n${buildKitchenContext(kitchen)}` }] },
        { role: 'model', parts: [{ text: 'Anladım, mutfağını görüyorum. Ne yapmak istersin?' }] },
        ...history.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      ];

      let response;
      try {
        response = await fetchFn(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents,
              generationConfig: {
                temperature: 0.6,
                responseMimeType: 'application/json',
                responseSchema: GEMINI_CHEF_SCHEMA,
              },
            }),
          },
        );
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`Gemini chef request failed: ${response.status} ${response.statusText}`);
      }

      const body = await response.json();
      const parsed = JSON.parse(body.candidates[0].content.parts[0].text);

      return {
        reply: parsed.reply ?? '',
        suggestedShoppingItems: (parsed.suggestedShoppingItems ?? []).map((s) => ({
          name: s.name,
          quantity: s.quantity ?? null,
          unit: s.unit ?? null,
          reasonText: s.reasonText ?? '',
        })),
      };
    },
  };
};

export { makeGeminiChefChat, GEMINI_CHEF_SCHEMA };
