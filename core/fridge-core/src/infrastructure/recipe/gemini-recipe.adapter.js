import { toGeminiSchema } from '../gemini/gemini-schema.js';
import { RECIPE_RESPONSE_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } from './recipe-prompt.js';
import { callGemini, extractJson } from '../gemini/gemini-client.js';

const GEMINI_RECIPE_SCHEMA = toGeminiSchema(RECIPE_RESPONSE_SCHEMA);

// recipe-generator-port.js sözleşmesini uygular. gemini-text.adapter.js ile
// aynı REST çağrı şekli, iki fark: temperature yüksek (tarif üretimi
// yaratıcılık istiyor, fiş ayrıştırma tam tersini) ve timeout daha uzun
// (üç tarif + adımlar tek istekte üretiliyor, daha çok token demek).
// HTTP/hata/retry/kullanım ölçümü artık gemini-client.js'de paylaşılıyor.
const makeGeminiRecipeGenerator = ({ apiKey, model, fetchFn = fetch, onUsage }) => {
  return {
    generate: async ({ ingredients, beverages = [], preferences, context }) => {
      const body = await callGemini({
        apiKey,
        model,
        feature: 'recipe',
        systemPrompt: SYSTEM_PROMPT,
        contents: [{ role: 'user', parts: [{ text: buildUserPrompt({ ingredients, beverages, preferences }) }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_RECIPE_SCHEMA,
        },
        timeoutMs: 45_000,
        fetchFn,
        onUsage,
        context,
      });

      const parsed = extractJson(body);

      return {
        recipes: parsed.recipes.map((recipe) => ({
          title: recipe.title,
          description: recipe.description,
          servings: recipe.servings ?? null,
          prepMinutes: recipe.prepMinutes ?? null,
          cookMinutes: recipe.cookMinutes ?? null,
          difficulty: recipe.difficulty ?? null,
          steps: (recipe.steps ?? []).map((step, index) => ({
            order: step.order ?? index + 1,
            text: step.text,
            minutes: step.minutes ?? null,
          })),
          ingredients: recipe.ingredients ?? [],
          missingIngredients: recipe.missingIngredients ?? [],
          tags: recipe.tags ?? [],
        })),
      };
    },
  };
};

export { makeGeminiRecipeGenerator, GEMINI_RECIPE_SCHEMA };
