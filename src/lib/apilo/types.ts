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
  tax: string;
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
  products: Array<{ id?: number; sku?: string; name?: string }>;
}

export interface ApiloApiError {
  message: string;
  status: number;
  details?: unknown;
}
