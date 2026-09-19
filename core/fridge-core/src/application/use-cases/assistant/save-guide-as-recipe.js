import { ValidationError, NotFoundError } from '@fridge/errors';

// POST /assistant/messages/:messageId/save-guide (bkz. plan §C6). AI çağırmaz
// — guide zaten assistant_message.meta'da saklı, requireCapability gerekmez
// (§C4).
//
// KATALOG KİRLENMESİ KURALI KORUNUR (generate-ai-recipes.use-case.js:87-90
// deseni): eşleşmeyen malzeme için YENİ product YARATILMAZ, customName
// kullanılır. Task tarafında kritik — "M8 cıvata" yemek kataloğuna
// girmemeli.
const makeSaveGuideAsRecipe = ({
  conversationRepo,
  householdMemberRepo,
  datasource,
  makeProductRepo,
  makeRecipeRepo,
}) => {
  return async ({ messageId, userId, householdId }) => {
    const message = await conversationRepo.findMessageById(messageId);
    if (!message) throw new NotFoundError('Message not found');

    const conversation = await conversationRepo.findById(message.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new NotFoundError('Message not found');
    }

    const guide = message.meta?.guide;
    if (!guide) {
      throw new ValidationError('Bu mesajda kaydedilecek bir kılavuz yok');
    }

    const targetHouseholdId = householdId ?? conversation.householdId;
    if (!targetHouseholdId) {
      throw new ValidationError('Tarif/kılavuz kaydetmek için bir alan seçilmeli');
    }

    const membership = await householdMemberRepo.findMembership({ householdId: targetHouseholdId, userId });
    if (!membership) {
      throw new NotFoundError('Household not found');
    }

    const steps = (guide.steps ?? []).map((s, idx) => ({
      order: s.order ?? idx + 1,
      text: s.text,
      minutes: s.minutes ?? null,
    }));
    const instructions = steps.map((s) => `${s.order}. ${s.text}`).join('\n');

    return datasource.withTransaction(async ({ query }) => {
      const productRepo = makeProductRepo({ rawQuery: query });
      const recipeRepo = makeRecipeRepo({ rawQuery: query });

      const recipe = await recipeRepo.create({
        householdId: targetHouseholdId,
        title: guide.title,
        instructions,
        steps,
        servings: guide.servings ?? null,
        prepMinutes: guide.prepMinutes ?? null,
        cookMinutes: guide.cookMinutes ?? null,
        createdBy: userId,
        generatedBy: 'ai',
        kind: guide.kind === 'task' ? 'task' : 'food',
      });

      for (const material of guide.materials ?? []) {
        const matches = await productRepo.search({ householdId: targetHouseholdId, query: material.name, limit: 1 });
        const product = matches[0];
        await recipeRepo.addIngredient({
          recipeId: recipe.id,
          productId: product?.id ?? null,
          customName: product ? null : material.name,
          quantity: material.quantity ?? null,
          unit: material.unit ?? null,
          isOptional: material.isOptional ?? false,
        });
      }

      return recipe;
    });
  };
};

export { makeSaveGuideAsRecipe };
