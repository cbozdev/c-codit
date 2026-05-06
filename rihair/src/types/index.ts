import type {
  Product,
  ProductVariant,
  ProductImage,
  Category,
  Order,
  OrderItem,
  User,
  Currency,
  HairOrigin,
  HairTexture,
  LaceType,
  HairDensity,
} from "@prisma/client";

// ============================================================
// PRODUCT TYPES
// ============================================================

export type ProductWithRelations = Product & {
  category: Category;
  variants: ProductVariant[];
  images: ProductImage[];
  _count?: {
    reviews: number;
    wishlists: number;
  };
};

export type ProductCardData = Pick<
  Product,
  | "id"
  | "slug"
  | "name"
  | "basePrice"
  | "compareAtPrice"
  | "currency"
  | "hairOrigin"
  | "hairTexture"
  | "laceType"
  | "averageRating"
  | "reviewCount"
  | "isBestSeller"
  | "isNewArrival"
  | "isOnSale"
  | "isFeatured"
> & {
  primaryImage: string | null;
  category: Pick<Category, "name" | "slug">;
  variants: Pick<ProductVariant, "id" | "lengthInches" | "density" | "price" | "stockQuantity" | "color">[];
};

export type VariantOption = {
  label: string;
  value: string;
  available: boolean;
  priceModifier?: number;
};

// ============================================================
// CART TYPES
// ============================================================

export type CartItemData = {
  id: string;
  productId: string;
  variantId: string | null;
  product: Pick<Product, "id" | "slug" | "name" | "requiresShipping"> & {
    primaryImage: string | null;
  };
  variant: Pick<ProductVariant, "id" | "sku" | "price" | "stockQuantity" | "color" | "lengthInches" | "density"> | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type CartSummary = {
  items: CartItemData[];
  itemCount: number;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: Currency;
};

// ============================================================
// CURRENCY & PRICING
// ============================================================

export type SupportedCurrency = "NGN" | "GHS" | "USD" | "GBP" | "CAD";

export type CurrencyConfig = {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  locale: string;
  fractionDigits: number;
};

export type PriceRange = {
  min: number;
  max: number;
  currency: SupportedCurrency;
};

// ============================================================
// FILTERS & SEARCH
// ============================================================

export type FilterOption<T = string> = {
  label: string;
  value: T;
  count?: number;
};

export type ActiveFilters = {
  category?: string;
  origin?: HairOrigin;
  texture?: HairTexture;
  laceType?: LaceType;
  density?: HairDensity;
  priceRange?: PriceRange;
  lengthRange?: [number, number];
};

export type SortOption = {
  label: string;
  value: "newest" | "price_asc" | "price_desc" | "popular" | "rating" | "featured";
};

// ============================================================
// ORDER TYPES
// ============================================================

export type OrderWithItems = Order & {
  items: (OrderItem & {
    product: Pick<Product, "id" | "slug" | "name">;
    variant: Pick<ProductVariant, "id" | "color" | "lengthInches" | "density"> | null;
  })[];
  user?: Pick<User, "id" | "email" | "firstName" | "lastName"> | null;
};

// ============================================================
// PAYMENT TYPES
// ============================================================

export type PaymentRegion = "west_africa" | "international";

export type PaymentInitParams = {
  orderId: string;
  amount: number;
  currency: SupportedCurrency;
  email: string;
  region: PaymentRegion;
  metadata?: Record<string, unknown>;
};

export type PaymentVerifyResult = {
  success: boolean;
  reference: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
};

// ============================================================
// API RESPONSE TYPES
// ============================================================

export type ApiResponse<T = unknown> = {
  data?: T;
  error?: string;
  message?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

// ============================================================
// GEOLOCATION
// ============================================================

export type GeoLocation = {
  country: string;
  countryCode: string;
  region: string;
  currency: SupportedCurrency;
  timezone: string;
  paymentRegion: PaymentRegion;
};

// ============================================================
// BOOKING TYPES
// ============================================================

export type ServiceDetails = {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  currency: SupportedCurrency;
  depositRequired: boolean;
  depositAmount?: number;
};
