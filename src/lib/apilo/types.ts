export interface ApiloTokenResponse {
  accessToken: string;
  accessTokenExpireAt: string;
  refreshToken: string;
  refreshTokenExpireAt: string;
}

export interface ApiloCategory {
  id: string;
  name: string;
  parentIds: number[];
}

export interface ApiloCategoriesResponse {
  categories: ApiloCategory[];
  totalCount: number;
  currentOffset: number;
  pageResultCount: number;
}

export interface ApiloWarehouseProductPayload {
  originalCode?: string;
  name: string;
  sku: string;
  quantity: number;
  priceWithTax: string;
  tax: number;
  status: 0 | 1;
  groupName?: string | null;
  attributes?: Record<string, string | number>;
  images?: Record<string, string>;
  categories?: number[];
  ean?: string;
  weight?: number;
  unit?: string;
  description?: string;
  shortDescription?: string;
}

export interface ApiloCreateProductsResponse {
  products:
    | Array<{ id?: number; sku?: string; name?: string }>
    | Record<string, number>;
}

/** Pełna aktualizacja produktu — PUT /rest/api/warehouse/product/ */
export interface ApiloWarehouseProductPutPayload {
  id: number;
  sku: string;
  name: string;
  tax: string;
  status: 0 | 1;
  quantity: number;
  priceWithTax: string;
  originalCode?: string;
  groupName?: string | null;
  attributes?: Record<string, string | number>;
  images?: Record<string, string>;
  categories?: number[];
  ean?: string;
  weight?: number;
  unit?: string;
  description?: string;
  shortDescription?: string;
  location?: string | null;
}

/** Częściowa aktualizacja — PATCH /rest/api/warehouse/product/ */
export interface ApiloWarehouseProductPatchPayload {
  id?: number;
  originalCode?: string | null;
  sku?: string | null;
  quantity?: number;
  priceWithTax?: string;
  tax?: string;
  status?: 0 | 1 | 8 | null;
}

export interface ApiloUpdateProductsResponse {
  updated?: number;
  changes?: number;
}

export interface ApiloWarehouseProductDetail {
  id: number;
  sku: string;
  name: string;
  groupName?: string;
  quantity: number;
  priceWithTax: number | string;
  tax: string;
  status: number;
  ean?: string;
  weight?: number;
  unit?: string;
  description?: string;
  shortDescription?: string;
  categories?: number[];
  originalCode?: string;
}

export interface ApiloApiError {
  message: string;
  status: number;
  details?: unknown;
}
