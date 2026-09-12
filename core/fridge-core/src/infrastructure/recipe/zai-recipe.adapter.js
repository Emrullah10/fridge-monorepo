import { RECIPE_RESPONSE_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } from './recipe-prompt.js';
import { callZai, extractJson, DEFAULT_MODEL } from '../ai/zai.js';

// recipe-generator-port.js sözleşmesini uygular.
// Z.ai'nin OpenAI uyumlu /chat/completions ucu üzerinden tarifleri üretir.
const makeZaiRecipeGenerator = ({ apiKey, model = DEFAULT_MODEL, fetchFn = fetch, onUsage }) => {
  return {
    generate: async ({ ingredients, beverages = [], preferences, context }) => {
      const prompt = buildUserPrompt({ ingredients, beverages, preferences });
      const userPrompt = `${prompt}\n\nJSON şemasına uygun cevap ver: ${JSON.stringify(RECIPE_RESPONSE_SCHEMA)}`;

      const body = await callZai({
        apiKey,
        model,
        feature: 'recipe',
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.7,
        maxTokens: 4096,
        timeoutMs: 45_000,
        fetchFn,
        onUsage,
        context,
      });

      const parsed = extractJson(body);

      return {
        recipes: (parsed.recipes ?? []).map((recipe) => ({
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

export { makeZaiRecipeGenerator };
