import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { secretsMatch } from '../../../services/fridge-api/routes/billing.routes.js';

describe('secretsMatch — RevenueCat webhook secret karşılaştırması (timing-safe, güvenlik regresyon testi)', () => {
  test('aynı secret eşleşir', () => {
    assert.equal(secretsMatch('shared-secret-123', 'shared-secret-123'), true);
  });

  test('farklı secret eşleşmez', () => {
    assert.equal(secretsMatch('wrong-secret', 'shared-secret-123'), false);
  });

  test('farklı uzunluktaki string exception fırlatmadan false döner', () => {
    assert.equal(secretsMatch('short', 'a-much-longer-secret-value'), false);
  });

  test('undefined header ile karşılaştırma exception fırlatmaz', () => {
    assert.equal(secretsMatch(undefined, 'shared-secret-123'), false);
  });

  test('her ikisi de boş/undefined ise eşleşmez (defense-in-depth — config.revenueCatWebhookSecret null iken çağıran taraf zaten 503 ile önceden reddediyor)', () => {
    assert.equal(secretsMatch(undefined, undefined), false);
    assert.equal(secretsMatch('', ''), false);
    assert.equal(secretsMatch(null, null), false);
  });
});
