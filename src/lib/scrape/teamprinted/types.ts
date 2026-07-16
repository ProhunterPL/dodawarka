export interface TeamPrintedListItem {
  productId: string;
  slug: string;
  title: string;
  price: string;
  compareAtPrice: string;
  category: string;
  imageUrl: string;
  productUrl: string;
  colorNames: string[];
  colorHexes: string[];
}

export interface TeamPrintedProductDetail extends TeamPrintedListItem {
  sizes: string[];
  descriptionText: string;
  shortDescription: string;
  imageUrls: string[];
  sourceUrl: string;
  /** Detail pages currently return a “coming soon” shell — listing is the source of truth. */
  detailAvailable: boolean;
}
