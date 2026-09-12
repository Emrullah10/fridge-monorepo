import { callAiModel, extractJson } from './ai-client.js';

// Z.ai'ye özgü sabitler — ai-client.js sağlayıcıdan bağımsız kalır, burada
// yalnızca URL/etiket/varsayılan model/thinking ayarı toplanır. Bkz.
// docs/AI_PROVIDER_SPEC.md ve docs/ZAI_MIGRATION_PLAN.md.
const ZAI_CHAT_COMPLETIONS_URL = 'https://api.z.ai/api/paas/v4/chat/completions';

// 2026-09-12 canlı deneme: ücretsiz glm-4.7-flash sürekli 429/1305 (sunucu
// tarafı aşırı yük) verdi, timeout'a kadar gitti — üretimde kullanılamaz
// durumdaydı. Ücretsiz glm-4.5-flash yanıt verdi ama yavaş (~19-20sn) ve
// gerçek bir fişte birim/isim hatası yaptı. Ücretli glm-4.6 ($0.60/$2.20)
// hem hızlı (~8-9sn) hem daha doğru çıktı — kullanıcı kararıyla KALICI
// model bu oldu. thinking.disabled glm-4.6'da destekleniyor ve reasoning
// token'ı üretmiyor (bkz. docs/ZAI_MIGRATION_PLAN.md).
const DEFAULT_MODEL = 'glm-4.6';
const DEFAULT_THINKING = { type: 'disabled' };

const callZai = (params) =>
  callAiModel({
    ...params,
    baseUrl: ZAI_CHAT_COMPLETIONS_URL,
    providerLabel: 'zai',
    thinking: params.thinking ?? DEFAULT_THINKING,
  });

export { callZai, extractJson, DEFAULT_MODEL };
