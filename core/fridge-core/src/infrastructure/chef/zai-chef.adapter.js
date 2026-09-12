import { CHEF_RESPONSE_SCHEMA, SYSTEM_PROMPT, buildKitchenContext } from './chef-prompt.js';
import { callZai, extractJson, DEFAULT_MODEL } from '../ai/zai.js';

// chef-chat-port.js sözleşmesini uygular.
// Z.ai'nin OpenAI uyumlu /chat/completions ucu üzerinden çalışır.
// Çok turlu sohbet geçmişi ve mutfak bağlamı mesajlar dizisi olarak geçirilir.
const makeZaiChefChat = ({ apiKey, model = DEFAULT_MODEL, fetchFn = fetch, onUsage }) => {
  return {
    reply: async ({ history, kitchen, context }) => {
      const systemPromptWithSchema = `${SYSTEM_PROMPT}\n\nCevabını JSON şemasına uygun geçerli bir JSON nesnesi olarak ver:\n${JSON.stringify(CHEF_RESPONSE_SCHEMA)}`;

      const messages = [
        { role: 'user', content: `MUTFAK DURUMU:\n${buildKitchenContext(kitchen)}` },
        { role: 'assistant', content: 'Anladım, mutfağını görüyorum. Ne yapmak istersin?' },
        ...history.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      ];

      const body = await callZai({
        apiKey,
        model,
        feature: 'chef',
        systemPrompt: systemPromptWithSchema,
        messages,
        temperature: 0.6,
        maxTokens: 4096,
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

export { makeZaiChefChat };
