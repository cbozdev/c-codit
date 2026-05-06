export const HAIR_ORIGINS = [
  { value: "BRAZILIAN", label: "Brazilian" },
  { value: "PERUVIAN", label: "Peruvian" },
  { value: "CAMBODIAN", label: "Cambodian" },
  { value: "INDIAN", label: "Indian" },
  { value: "MALAYSIAN", label: "Malaysian" },
  { value: "BURMESE", label: "Burmese" },
] as const;

export const HAIR_TEXTURES = [
  { value: "STRAIGHT", label: "Straight" },
  { value: "BODY_WAVE", label: "Body Wave" },
  { value: "CURLY", label: "Curly" },
  { value: "DEEP_WAVE", label: "Deep Wave" },
  { value: "WATER_WAVE", label: "Water Wave" },
  { value: "LOOSE_WAVE", label: "Loose Wave" },
  { value: "KINKY_CURLY", label: "Kinky Curly" },
  { value: "YAKI_STRAIGHT", label: "Yaki Straight" },
] as const;

export const LACE_TYPES = [
  { value: "HD_LACE", label: "HD Lace" },
  { value: "TRANSPARENT_LACE", label: "Transparent Lace" },
  { value: "BROWN_LACE", label: "Brown Lace" },
  { value: "SWISS_LACE", label: "Swiss Lace" },
  { value: "FULL_LACE", label: "Full Lace" },
] as const;

export const DENSITIES = [
  { value: "DENSITY_130", label: "130%" },
  { value: "DENSITY_150", label: "150%" },
  { value: "DENSITY_180", label: "180%" },
  { value: "DENSITY_200", label: "200%" },
  { value: "DENSITY_250", label: "250%" },
] as const;

export const LENGTHS = Array.from({ length: 16 }, (_, i) => ({
  value: String(10 + i * 2),
  label: `${10 + i * 2}"`,
}));

export const CATEGORIES = [
  {
    value: "HUMAN_HAIR_WIGS",
    slug: "human-hair-wigs",
    label: "Human Hair Wigs",
  },
  {
    value: "FRONTAL_WIGS",
    slug: "frontal-wigs",
    label: "Frontal Wigs",
  },
  {
    value: "CLOSURE_WIGS",
    slug: "closure-wigs",
    label: "Closure Wigs",
  },
  {
    value: "HAIR_BUNDLES",
    slug: "hair-bundles",
    label: "Hair Bundles",
  },
  {
    value: "RAW_VIRGIN_HAIR",
    slug: "raw-virgin-hair",
    label: "Raw Virgin Hair",
  },
  {
    value: "HAIR_ACCESSORIES",
    slug: "hair-accessories",
    label: "Hair Accessories",
  },
  {
    value: "CUSTOM_WIGS",
    slug: "custom-wigs",
    label: "Custom Wigs",
  },
] as const;

export const SORT_OPTIONS = [
  { value: "newest", label: "New Arrivals" },
  { value: "popular", label: "Most Popular" },
  { value: "rating", label: "Top Rated" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "featured", label: "Featured" },
] as const;

export const PRODUCTS_PER_PAGE = 24;
export const RELATED_PRODUCTS_COUNT = 4;
