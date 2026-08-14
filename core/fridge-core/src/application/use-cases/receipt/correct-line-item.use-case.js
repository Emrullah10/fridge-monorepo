// Kullanıcı bir satırı düzeltirse product_alias'a yazılır — bir daha aynı
// market kısaltması modele hiç gitmeden sözlükten çözülür.
const makeCorrectLineItem = ({ receiptLineItemRepo, productAliasRepo }) => {
  return async ({ lineItemId, householdId, parsedName, parsedQuantity, parsedUnit, matchedProductId }) => {
    const updated = await receiptLineItemRepo.update(lineItemId, {
      parsedName,
      parsedQuantity,
      parsedUnit,
      matchedProductId,
      matchMethod: 'manual',
      status: null,
    });

    if (matchedProductId) {
      await productAliasRepo.upsertUserCorrection({
        householdId,
        rawText: updated.rawText,
        productId: matchedProductId,
      });
    }

    return updated;
  };
};

export { makeCorrectLineItem };
