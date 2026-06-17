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
  /** Notatki i mapowania per kanał (lokalnie — bez auto-publikacji w Apilo). */
  channelMetadata?: ChannelMetadataMap;
  /** Mapowanie SKU wariantu → ID produktu w Apilo (tryb aktualizacji). */
  apiloIdsBySku?: Record<string, number>;
}

export interface ChannelMetadataEntry {
  marketplaceCategory?: string;
  parameters?: string;
  listingTitle?: string;
  notes?: string;
}

export type ChannelMetadataMap = Partial<Record<string, ChannelMetadataEntry>>;

export type ProductUpdateScope = "full" | "quick" | "metadata";

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
  updatedAt?: string;
  groupName: string;
  sku: string;
  status: ProductStatus;
  apiloProductIds?: number[];
  variantApiloIds?: Record<string, number>;
  formSnapshot?: ProductFormInput;
  importStatus: "draft" | "dry-run" | "success" | "error" | "updated";
  errorMessage?: string;
  variantSkus?: string[];
}

export interface ImportLogEntry {
  id: string;
  timestamp: string;
  action: "dry-run" | "import" | "update";
  sku: string;
  success: boolean;
  message: string;
  apiloProductIds?: number[];
}

export interface ProductTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  product: ProductFormInput;
}
