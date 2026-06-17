export interface KoszulkerListItem {
  productId: string;
  title: string;
  price: string;
  imageUrl: string;
  productUrl: string;
  gender: "mezczyzna" | "kobieta" | "unknown";
}

export interface KoszulkerProductDetail extends KoszulkerListItem {
  garmentType: string;
  garmentFit?: string;
  color: string;
  sizes: string[];
  descriptionHtml: string;
  descriptionText: string;
  shortDescription: string;
  extraDescription: string;
  imageUrls: string[];
  apiloTyp: string;
  sourceUrl: string;
}
