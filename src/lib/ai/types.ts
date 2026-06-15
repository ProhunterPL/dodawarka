import type { ProductFormInput, ValidationIssue } from "@/lib/product/types";

export interface AiFieldSuggestion {
  field: keyof ProductFormInput | "categoryIds";
  value: string | number | number[] | string[];
  reason: string;
}

export interface AiProductSuggestions {
  summary: string;
  suggestions: AiFieldSuggestion[];
}

export interface SuggestProductFixesInput {
  product: ProductFormInput;
  validationIssues?: ValidationIssue[];
  apiloError?: {
    message: string;
    status?: number;
    details?: unknown;
  };
  categories?: Array<{ id: string; name: string }>;
}
