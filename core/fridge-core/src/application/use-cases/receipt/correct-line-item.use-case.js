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
const makeCorrectLineItem = ({ receiptLineItemRepo, productAliasRepo, productRepo, productCategoryRepo }) => {
  return async ({
    lineItemId, householdId, parsedName, parsedBrand, parsedQuantity, parsedUnit,
    parsedPackSize, parsedPackUnit, matchedProductId, categoryKey,
  }) => {
    const updated = await receiptLineItemRepo.update(lineItemId, {
      parsedName,
      parsedBrand,
      parsedQuantity,
      parsedUnit,
      parsedPackSize,
      parsedPackUnit,
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

      // Kullanıcının kategori seçimi tarif AI'ının doğru sınıflandırma
      // yapması için tek geribesleme mekanizmasıdır (bkz. recipe-eligibility.js).
      if (categoryKey !== undefined && productCategoryRepo) {
        const category = await productCategoryRepo.findByKey(categoryKey);
        await productRepo.updateCategoryId(matchedProductId, category?.id ?? null);
      }

      // Paket boyutu düzeltmesi kalıcılaşır — updateBrand ile aynı mantık,
      // ama 'ai_generated' kısıtı YOK: paket boyutu objektif bir üretici
      // gerçeği, hangi kaynaktan geldiği ayrımı gerekmiyor.
      if (parsedPackSize !== undefined && parsedPackUnit !== undefined) {
        await productRepo.updatePackSize(matchedProductId, { packSize: parsedPackSize, packUnit: parsedPackUnit });
      }
    }

    return updated;
  };
};

export { makeCorrectLineItem };
