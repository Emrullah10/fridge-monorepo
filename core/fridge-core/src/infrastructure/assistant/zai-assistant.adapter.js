import { ASSISTANT_RESPONSE_SCHEMA, buildSystemPrompt, buildAreaContext } from './assistant-prompt.js';
import { callZai, extractJson, DEFAULT_MODEL } from '../ai/zai.js';

// assistant-chat-port.js sözleşmesini uygular (zai-chef.adapter.js'in
// genellemesi, bkz. plan §C1). Z.ai'nin OpenAI uyumlu /chat/completions
// ucu üzerinden çalışır.
//
// Vision'a hazırlık (bugün kullanılmaz, bkz. plan §B4): mesaj kurulumu tek
// yardımcıya çıkarılmış (toProviderMessage) — vision geldiğinde tek satır
// değişir: content: m.parts ?? m.content.
const toProviderMessage = (m) => ({
  role: m.role === 'assistant' ? 'assistant' : 'user',
  content: m.parts ?? m.content,
});

const makeZaiAssistantChat = ({ apiKey, model = DEFAULT_MODEL, fetchFn = fetch, onUsage }) => {
  return {
    reply: async ({ history, area, mode = 'general', foodEnabled = true, areaName = null, areaKind = null, context }) => {
      const systemPromptWithSchema = `${buildSystemPrompt({ mode, hasHousehold: Boolean(area), foodEnabled })}\n\nCevabını JSON şemasına uygun geçerli bir JSON nesnesi olarak ver:\n${JSON.stringify(ASSISTANT_RESPONSE_SCHEMA)}`;

      // area:null (alansız sohbet) ise sahte user/assistant bağlam çifti
      // hiç eklenmez — model envanter bilgisi olduğunu sanmasın.
      const messages = [
        ...(area
          ? [
              { role: 'user', content: `ALAN DURUMU:\n${buildAreaContext({ area, areaName, areaKind, foodEnabled })}` },
              { role: 'assistant', content: 'Anladım, alanını görüyorum. Ne yapmak istersin?' },
            ]
          : []),
        ...history.map(toProviderMessage),
      ];

      const body = await callZai({
        apiKey,
        model,
        feature: 'chef', // §A5: feature anahtarı tarihsel, DEĞİŞTİRİLMEZ
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
        conversationTitle: parsed.conversationTitle ?? null,
        modeMismatch: parsed.modeMismatch ?? null,
        guide: parsed.guide ?? null,
      };
    },
  };
};

export { makeZaiAssistantChat };
