import { toGeminiSchema } from '../gemini/gemini-schema.js';
import { RECIPE_RESPONSE_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } from './recipe-prompt.js';

const GEMINI_RECIPE_SCHEMA = toGeminiSchema(RECIPE_RESPONSE_SCHEMA);

// recipe-generator-port.js sözleşmesini uygular. gemini-text.adapter.js ile
// aynı REST çağrı şekli, iki fark: temperature yüksek (tarif üretimi
// yaratıcılık istiyor, fiş ayrıştırma tam tersini) ve timeout daha uzun
// (üç tarif + adımlar tek istekte üretiliyor, daha çok token demek).
const makeGeminiRecipeGenerator = ({ apiKey, model, fetchFn = fetch }) => {
  return {
    generate: async ({ ingredients, beverages = [], preferences }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);

      let response;
      try {
        response = await fetchFn(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ role: 'user', parts: [{ text: buildUserPrompt({ ingredients, beverages, preferences }) }] }],
              generationConfig: {
                temperature: 0.7,
                responseMimeType: 'application/json',
                responseSchema: GEMINI_RECIPE_SCHEMA,
              },
            }),
          },
        );
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`Gemini recipe request failed: ${response.status} ${response.statusText}`);
      }

      const body = await response.json();
      const parsed = JSON.parse(body.candidates[0].content.parts[0].text);

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
