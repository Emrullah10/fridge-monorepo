// Kullanıcı bir satırı düzeltirse product_alias'a yazılır — bir daha aynı
// market kısaltması modele hiç gitmeden sözlükten çözülür. Marka düzeltmesi
// de aynı mantıkla kalıcılaşır: kullanıcının girdiği marka product.brand'e
// yazılır, böylece o ürün için AI'a bir daha ihtiyaç kalmaz.
const makeCorrectLineItem = ({ receiptLineItemRepo, productAliasRepo, productRepo }) => {
  return async ({
    lineItemId, householdId, parsedName, parsedBrand, parsedQuantity, parsedUnit, matchedProductId,
  }) => {
    const updated = await receiptLineItemRepo.update(lineItemId, {
      parsedName,
      parsedBrand,
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

      if (parsedBrand !== undefined) {
        await productRepo.updateBrand(matchedProductId, parsedBrand);
      }
    }

    return updated;
  };
};

export { makeCorrectLineItem };
