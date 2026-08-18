// Kullanıcı bir satırı düzeltirse product_alias'a yazılır — bir daha aynı
// market kısaltması modele hiç gitmeden sözlükten çözülür. Marka düzeltmesi
// de aynı mantıkla kalıcılaşır: kullanıcının girdiği marka product.brand'e
// yazılır, böylece o ürün için AI'a bir daha ihtiyaç kalmaz.
//
// İsim düzeltmesi de aynı şekilde product.canonicalName'e yazılır — ama
// sadece ürün 'ai_generated' ise. Katalogdaki paylaşılan/gerçek bir ürünün
// adını tek bir kullanıcının düzeltmesiyle değiştirmek istenmiyor; AI'ın
// uydurduğu isim ise düzeltmeye açık ve bu olmadan bir sonraki fişte alias
// eşleşip eski yanlış ismi geri getiriyordu.
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

      if (parsedName?.trim()) {
        const product = await productRepo.findById(matchedProductId);
        if (product?.source === 'ai_generated') {
          await productRepo.updateCanonicalName(matchedProductId, parsedName.trim());
        }
      }
    }

    return updated;
  };
};

export { makeCorrectLineItem };
