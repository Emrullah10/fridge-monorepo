import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { extractJson } from '../../../src/infrastructure/ai/ai-client.js';

const body = (content) => ({ choices: [{ message: { content } }] });

describe('extractJson', () => {
  test('düz JSON', () => {
    assert.deepEqual(extractJson(body('{"a":1}')), { a: 1 });
  });

  test('```json çitli yanıtı ayrıştırır', () => {
    assert.deepEqual(extractJson(body('```json\n{"a":1}\n```')), { a: 1 });
  });

  test('JSON etrafındaki açıklama metnini atar', () => {
    assert.deepEqual(extractJson(body('İşte öneriler:\n{"a":[1,2]}\nUmarım yardımcı olur')), { a: [1, 2] });
  });

  test('kesik/bozuk yanıt AI_BAD_RESPONSE döner (500 değil)', () => {
    assert.throws(() => extractJson(body('{"suggestions":[{"name":"Ek')), { code: 'AI_BAD_RESPONSE' });
  });

  test('boş yanıt AI_BAD_RESPONSE döner', () => {
    assert.throws(() => extractJson({ choices: [] }), { code: 'AI_BAD_RESPONSE' });
  });
});
