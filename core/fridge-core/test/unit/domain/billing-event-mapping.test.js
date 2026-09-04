import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveStatusForEventType,
  mapRcStoreToOurStore,
  parseRevenueCatWebhookPayload,
} from '../../../src/domain/billing-event-mapping.js';

describe('billing-event-mapping — resolveStatusForEventType', () => {
  test('13 durumun tamamı doğru statüye eşleniyor', () => {
    assert.equal(resolveStatusForEventType('INITIAL_PURCHASE'), 'active');
    assert.equal(resolveStatusForEventType('RENEWAL'), 'active');
    assert.equal(resolveStatusForEventType('UNCANCELLATION'), 'active');
    assert.equal(resolveStatusForEventType('PRODUCT_CHANGE'), 'active');
    assert.equal(resolveStatusForEventType('CANCELLATION'), 'canceled');
    assert.equal(resolveStatusForEventType('BILLING_ISSUE'), 'in_grace');
    assert.equal(resolveStatusForEventType('EXPIRATION'), 'expired');
    assert.equal(resolveStatusForEventType('REFUND'), 'revoked');
    assert.equal(resolveStatusForEventType('SUBSCRIPTION_PAUSED'), 'paused');
    assert.equal(resolveStatusForEventType('TRANSFER'), 'expired');
  });

  test('bilinmeyen event tipi null döner, boot çökmez', () => {
    assert.equal(resolveStatusForEventType('SOME_NEW_RC_EVENT_TYPE'), null);
  });
});

describe('billing-event-mapping — mapRcStoreToOurStore', () => {
  test('PLAY_STORE -> play, APP_STORE -> app_store', () => {
    assert.equal(mapRcStoreToOurStore('PLAY_STORE'), 'play');
    assert.equal(mapRcStoreToOurStore('APP_STORE'), 'app_store');
  });

  test('bilinmeyen store -> promo (CHECK kısıtı geçersizi zaten reddeder)', () => {
    assert.equal(mapRcStoreToOurStore('STRIPE'), 'promo');
    assert.equal(mapRcStoreToOurStore(undefined), 'promo');
  });
});

describe('billing-event-mapping — parseRevenueCatWebhookPayload', () => {
  test('gerçekçi bir RC INITIAL_PURCHASE payload\'ını doğru normalize eder', () => {
    const body = {
      api_version: '1.0',
      event: {
        id: 'evt_123',
        type: 'INITIAL_PURCHASE',
        app_user_id: 'user-abc',
        product_id: 'fridge_premium_monthly',
        store: 'PLAY_STORE',
        environment: 'PRODUCTION',
        expiration_at_ms: 1735689600000,
        original_transaction_id: 'GPA.1234-5678',
      },
    };

    const parsed = parseRevenueCatWebhookPayload(body);

    assert.equal(parsed.eventId, 'evt_123');
    assert.equal(parsed.eventType, 'INITIAL_PURCHASE');
    assert.equal(parsed.appUserId, 'user-abc');
    assert.equal(parsed.productId, 'fridge_premium_monthly');
    assert.equal(parsed.purchaseToken, 'GPA.1234-5678');
    assert.equal(parsed.environment, 'production');
    assert.equal(parsed.raw.store, 'play');
    assert.ok(parsed.raw.currentPeriodEnd instanceof Date);
  });

  test('SANDBOX environment -> sandbox (prod entitlement\'ı kirletmez)', () => {
    const parsed = parseRevenueCatWebhookPayload({
      event: { id: 'e1', type: 'INITIAL_PURCHASE', app_user_id: 'u1', environment: 'SANDBOX' },
    });
    assert.equal(parsed.environment, 'sandbox');
  });

  test('event objesi eksikse null döner', () => {
    assert.equal(parseRevenueCatWebhookPayload({}), null);
    assert.equal(parseRevenueCatWebhookPayload(null), null);
    assert.equal(parseRevenueCatWebhookPayload(undefined), null);
  });

  test('temel alanlar (id/type/app_user_id) eksikse null döner', () => {
    assert.equal(parseRevenueCatWebhookPayload({ event: { type: 'X', app_user_id: 'u' } }), null); // id yok
    assert.equal(parseRevenueCatWebhookPayload({ event: { id: 'e', app_user_id: 'u' } }), null); // type yok
    assert.equal(parseRevenueCatWebhookPayload({ event: { id: 'e', type: 'X' } }), null); // app_user_id yok
  });

  test('purchaseToken sırayla store_transaction_id -> original_transaction_id -> transaction_id\'ye düşer', () => {
    const withStoreTxn = parseRevenueCatWebhookPayload({
      event: { id: 'e', type: 'RENEWAL', app_user_id: 'u', store_transaction_id: 'A', original_transaction_id: 'B', transaction_id: 'C' },
    });
    assert.equal(withStoreTxn.purchaseToken, 'A');

    const withOnlyOriginal = parseRevenueCatWebhookPayload({
      event: { id: 'e', type: 'RENEWAL', app_user_id: 'u', original_transaction_id: 'B', transaction_id: 'C' },
    });
    assert.equal(withOnlyOriginal.purchaseToken, 'B');

    const withOnlyTxn = parseRevenueCatWebhookPayload({
      event: { id: 'e', type: 'RENEWAL', app_user_id: 'u', transaction_id: 'C' },
    });
    assert.equal(withOnlyTxn.purchaseToken, 'C');
  });

  test('expiration_at_ms yoksa currentPeriodEnd null (canceled kalıcı hesap gibi ele alınmaz)', () => {
    const parsed = parseRevenueCatWebhookPayload({
      event: { id: 'e', type: 'EXPIRATION', app_user_id: 'u' },
    });
    assert.equal(parsed.raw.currentPeriodEnd, null);
  });
});
