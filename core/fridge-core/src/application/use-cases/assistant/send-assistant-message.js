import { ValidationError } from '@fridge/errors';

const MAX_MESSAGE_LEN = 2000;

// send-chef-message.use-case.js'in genellemesi (bkz. plan §C5). Kullanıcının
// mesajını kaydeder, (varsa) alan bağlamını toplar, modeli çağırır, cevabı
// kaydeder. suggestedShoppingItems ASLA doğrudan listeye yazılmaz — sadece
// döndürülür (halüsinasyon savunması, suggest-ai-shopping-items deseni).
//
// conversation.householdId == null ise buildAreaContext HİÇ ÇAĞRILMAZ —
// adaptöre area:null gider, sahte user/assistant bağlam çifti eklenmez.
const makeSendAssistantMessage = ({
  conversationRepo,
  buildAreaContext,
  assistantChatPort,
  clock,
}) => {
  return async ({ conversation, userId, message, isGuest = false }) => {
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) throw new ValidationError('Mesaj boş olamaz');
    if (text.length > MAX_MESSAGE_LEN) {
      throw new ValidationError(`Mesaj çok uzun (en fazla ${MAX_MESSAGE_LEN} karakter)`);
    }

    await conversationRepo.appendMessage({ conversationId: conversation.id, role: 'user', content: text });
    const history = await conversationRepo.listRecentMessages({ conversationId: conversation.id, limit: 20 });

    let area = null;
    let foodEnabled = true;
    let areaName = null;
    let areaKind = null;

    if (conversation.householdId) {
      const built = await buildAreaContext({ householdId: conversation.householdId, userId });
      area = built.area;
      foodEnabled = built.foodEnabled;
      areaName = built.household?.name ?? null;
      areaKind = built.household?.kind ?? null;
    }

    const {
      reply,
      suggestedShoppingItems,
      conversationTitle,
      modeMismatch,
      guide,
    } = await assistantChatPort.reply({
      history: history.map((m) => ({ role: m.role, content: m.content })),
      area,
      mode: conversation.mode,
      foodEnabled,
      areaName,
      areaKind,
      context: { userId, householdId: conversation.householdId, isGuest },
    });

    const saved = await conversationRepo.appendMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: reply,
      meta: {
        suggestedShoppingItems: suggestedShoppingItems ?? [],
        modeMismatch: modeMismatch ?? null,
        guide: guide ?? null,
      },
    });

    // Başlık YALNIZCA conversation.title NULL ise yazılır — sonraki
    // turlarda model tekrar üretse de yok sayılır (bkz. plan §B3).
    let updatedConversation = conversation;
    if (!conversation.title && conversationTitle) {
      updatedConversation = await conversationRepo.setTitleIfMissing(conversation.id, conversationTitle);
    } else {
      await conversationRepo.touch(conversation.id);
      updatedConversation = { ...conversation, updatedAt: clock.now() };
    }

    return {
      message: saved,
      conversation: updatedConversation,
      suggestedShoppingItems: suggestedShoppingItems ?? [],
      modeMismatch: modeMismatch ?? null,
      guide: guide ?? null,
    };
  };
};

export { makeSendAssistantMessage };
