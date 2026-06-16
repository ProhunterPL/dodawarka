import type { ChannelMetadataMap, ProductFormInput, ValidationIssue } from "@/lib/product/types";

export interface CsvParseError {
  row: number;
  message: string;
}

export interface BatchCsvRow {
  rowNumber: number;
  groupName: string;
  name: string;
  size: string;
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
  status: "draft" | "active";
  selectedChannels: string[];
  channelMetadata?: ChannelMetadataMap;
}

export interface BatchPreviewResult {
  products: ProductFormInput[];
  rowCount: number;
  groupCount: number;
  parseErrors: CsvParseError[];
  warnings: string[];
}

export interface BatchImportItemResult {
  groupName: string;
  sku: string;
  success: boolean;
  message: string;
  dryRun?: boolean;
  apiloProductIds?: number[];
  validationIssues?: ValidationIssue[];
  fallbackUsed?: boolean;
}

export interface BatchImportResult {
  totalGroups: number;
  successCount: number;
  failedCount: number;
  dryRun: boolean;
  results: BatchImportItemResult[];
}

export const BATCH_CSV_COLUMNS = [
  "groupName",
  "name",
  "size",
  "sku",
  "ean",
  "priceWithTax",
  "tax",
  "quantity",
  "weight",
  "unit",
  "description",
  "shortDescription",
  "categoryIds",
  "categoryLabel",
  "imageUrls",
  "status",
  "selectedChannels",
  "allegroCategory",
  "allegroParameters",
  "allegroListingTitle",
  "allegroNotes",
  "shoperCategory",
  "shoperParameters",
  "shoperListingTitle",
  "shoperNotes",
] as const;
