export interface Gs1CatalogEntry {
  ean: string;
  name: string;
  size: string | null;
}

export interface EanTemplateRow {
  groupName: string;
  name: string;
  sku: string;
  size: string;
  ean: string;
  gs1Name: string;
  sourceUrl: string;
}

export interface EanAssignmentRow {
  rowNumber: number;
  groupName: string;
  sku: string;
  size: string;
  ean: string;
  gs1Name: string;
}

export interface EanImportResult {
  rows: EanAssignmentRow[];
  errors: Array<{ row: number; message: string }>;
}

export const EAN_TEMPLATE_HEADERS = [
  "groupName",
  "name",
  "sku",
  "size",
  "ean",
  "gs1Name",
  "sourceUrl",
] as const;

export const GS1_EXPORT_HEADERS = ["gtin", "gs1Name", "size"] as const;
