import { toGeminiSchema } from '../gemini/gemini-schema.js';
import { CHEF_RESPONSE_SCHEMA, SYSTEM_PROMPT, buildKitchenContext } from './chef-prompt.js';
import { callGemini, extractJson } from '../gemini/gemini-client.js';

const GEMINI_CHEF_SCHEMA = toGeminiSchema(CHEF_RESPONSE_SCHEMA);

// chef-chat-port.js sözleşmesini uygular. gemini-recipe.adapter.js ile aynı
// REST çağrı şekli; fark: mutfak bağlamı ilk user turn'ünden önce ayrı bir
// "context" mesajı olarak veriliyor, sonra gerçek sohbet geçmişi ekleniyor.
// HTTP/hata/retry/kullanım ölçümü artık gemini-client.js'de paylaşılıyor.
const makeGeminiChefChat = ({ apiKey, model, fetchFn = fetch, onUsage }) => {
  return {
    reply: async ({ history, kitchen, context }) => {
      const contents = [
        { role: 'user', parts: [{ text: `MUTFAK DURUMU:\n${buildKitchenContext(kitchen)}` }] },
        { role: 'model', parts: [{ text: 'Anladım, mutfağını görüyorum. Ne yapmak istersin?' }] },
        ...history.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      ];

      const body = await callGemini({
        apiKey,
        model,
        feature: 'chef',
        systemPrompt: SYSTEM_PROMPT,
        contents,
        generationConfig: {
          temperature: 0.6,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_CHEF_SCHEMA,
        },
        timeoutMs: 45_000,
        fetchFn,
        onUsage,
        context,
      });

      const parsed = extractJson(body);

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
