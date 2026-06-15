export type ProductStatus = "draft" | "active";

export interface ProductVariantInput {
  size: string;
  sku: string;
  quantity: number;
  ean?: string;
}

export interface ProductFormInput {
  groupName: string;
  name: string;
  sku: string;
  ean: string;
  priceWithTax: string;
  tax: string;
  quantity: number;
  weight: number;
  unit: string;
  description: string;
  shortDescription: string;
  categoryIds: number[];
  categoryLabel: string;
  imageUrls: string[];
  status: ProductStatus;
  variants: ProductVariantInput[];
  selectedChannels: string[];
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface LocalProductRecord {
  id: string;
  createdAt: string;
  groupName: string;
  sku: string;
  status: ProductStatus;
  apiloProductIds?: number[];
  importStatus: "draft" | "dry-run" | "success" | "error";
  errorMessage?: string;
}

export interface ImportLogEntry {
  id: string;
  timestamp: string;
  action: "dry-run" | "import";
  sku: string;
  success: boolean;
  message: string;
  apiloProductIds?: number[];
}
