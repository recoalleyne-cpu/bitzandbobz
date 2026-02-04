function humanizeEnum(value: string): string {
  return value
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

export const catalogCategoryIds = [
  "CAR_ACCESSORIES",
  "DIY_TOOLS_GADGETS",
  "MENS_ACCESSORIES",
  "PHONE_ACCESSORIES",
  "WOMENS_ACCESSORIES",
  "SPECIAL"
] as const;

export type CatalogCategoryId = (typeof catalogCategoryIds)[number];

export type CatalogCategory = {
  id: CatalogCategoryId;
  label: string;
};

export const catalogCategories: readonly CatalogCategory[] = [
  { id: "CAR_ACCESSORIES", label: "Car Accessories" },
  { id: "DIY_TOOLS_GADGETS", label: "DIY Tools & Gadgets" },
  { id: "MENS_ACCESSORIES", label: "Men's Accessories" },
  { id: "PHONE_ACCESSORIES", label: "Phone Accessories" },
  { id: "WOMENS_ACCESSORIES", label: "Women's Accessories" },
  { id: "SPECIAL", label: "Special" }
];

export function getCatalogCategoryLabel(categoryId: string): string {
  const match = catalogCategories.find((category) => category.id === categoryId);
  return match ? match.label : humanizeEnum(categoryId);
}
