import { getAllCategories } from "@/lib/apilo/client";
import type { ApiloCategory } from "@/lib/apilo/types";
import { chatJson, isOpenAiConfigured } from "./openai-client";
import type {
  AiFieldSuggestion,
  AiProductSuggestions,
  SuggestProductFixesInput,
} from "./types";

const SYSTEM_PROMPT = `Jesteś asystentem e-commerce dla sklepu Incore Sports integrującego produkty z Apilo.
Twoim zadaniem jest uzupełnić braki w danych produktu na podstawie błędów walidacji lub odpowiedzi API Apilo.

Zasady:
- Odpowiadaj po polsku w polu summary i reason.
- Zwracaj TYLKO poprawny JSON zgodny ze schematem.
- Nie wymyślaj EAN/SKU — poprawiaj tylko opisy, kategorie, nazwy i pola tekstowe.
- shortDescription max 256 znaków.
- description powinien być kompletny, zgodny z charakterem produktu sportowego Incore Sports.
- Dla categoryIds wybierz najlepsze dopasowanie z podanej listy kategorii Apilo (jako tablica liczb).
- Jeśli brakuje kategorii, ustaw categoryIds i categoryLabel.
- Nie proponuj zmian pól, które są już poprawne.
- imageUrls: jeśli to linki OneDrive, zaproponuj wgranie przez S3 w aplikacji (nie podawaj fałszywych URL-i).

Schemat odpowiedzi:
{
  "summary": "krótkie podsumowanie co poprawiono",
  "suggestions": [
    {
      "field": "description | shortDescription | categoryIds | categoryLabel | groupName | name | sku | ean | imageUrls",
      "value": "wartość pola (dla categoryIds tablica liczb, dla imageUrls tablica stringów)",
      "reason": "dlaczego ta zmiana"
    }
  ]
}`;

function filterCategoriesForProduct(
  categories: ApiloCategory[],
  categoryLabel: string,
): Array<{ id: string; name: string }> {
  const query = categoryLabel.toLowerCase().trim();
  const tokens = query.split(/[\s/>,]+/).filter(Boolean);

  const scored = categories
    .map((category) => {
      const name = category.name.toLowerCase();
      const score = tokens.reduce(
        (sum, token) => sum + (name.includes(token) ? 1 : 0),
        0,
      );
      return { category, score };
    })
    .filter((item) => item.score > 0 || !query)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map((item) => ({ id: item.category.id, name: item.category.name }));

  if (scored.length > 0) {
    return scored;
  }

  return categories.slice(0, 40).map((category) => ({
    id: category.id,
    name: category.name,
  }));
}

export async function suggestProductFixes(
  input: SuggestProductFixesInput,
): Promise<AiProductSuggestions | null> {
  if (!isOpenAiConfigured()) {
    return null;
  }

  let categories = input.categories;
  if (!categories?.length) {
    try {
      const all = await getAllCategories();
      categories = filterCategoriesForProduct(all, input.product.categoryLabel);
    } catch {
      categories = [];
    }
  }

  const userPrompt = JSON.stringify(
    {
      product: input.product,
      validationIssues: input.validationIssues ?? [],
      apiloError: input.apiloError ?? null,
      availableCategories: categories,
      task:
        "Zaproponuj minimalne poprawki pól produktu, aby przejść walidację Apilo i uzupełnić braki w opisie/kategorii.",
    },
    null,
    2,
  );

  const result = await chatJson<AiProductSuggestions>(SYSTEM_PROMPT, userPrompt);

  if (!result.summary || !Array.isArray(result.suggestions)) {
    throw new Error("Niepoprawny format odpowiedzi AI.");
  }

  return {
    summary: result.summary,
    suggestions: result.suggestions
      .map(normalizeSuggestion)
      .filter((item): item is AiFieldSuggestion => item !== null),
  };
}

const ALLOWED_FIELDS = new Set<AiFieldSuggestion["field"]>([
  "description",
  "shortDescription",
  "categoryIds",
  "categoryLabel",
  "groupName",
  "name",
  "sku",
  "ean",
  "imageUrls",
  "priceWithTax",
  "tax",
  "unit",
  "quantity",
  "weight",
]);

function normalizeSuggestion(raw: unknown): AiFieldSuggestion | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as {
    field?: unknown;
    value?: unknown;
    reason?: unknown;
  };
  if (typeof item.field !== "string" || typeof item.reason !== "string") {
    return null;
  }

  const field = item.field as AiFieldSuggestion["field"];
  if (!ALLOWED_FIELDS.has(field)) {
    return null;
  }

  const normalizedValue = normalizeSuggestionValue(item.value, field);
  if (normalizedValue === undefined) {
    return null;
  }

  return {
    field,
    value: normalizedValue,
    reason: item.reason,
  };
}

function normalizeSuggestionValue(
  value: unknown,
  field: AiFieldSuggestion["field"],
): AiFieldSuggestion["value"] | undefined {
  if (field === "categoryIds") {
    if (!Array.isArray(value)) {
      return undefined;
    }
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  }

  if (field === "imageUrls") {
    if (!Array.isArray(value)) {
      return undefined;
    }
    return value.filter((item): item is string => typeof item === "string");
  }

  if (field === "quantity" || field === "weight") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : undefined;
  }

  return typeof value === "string" || typeof value === "number"
    ? value
    : undefined;
}
