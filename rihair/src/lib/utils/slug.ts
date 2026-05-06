import slugifyLib from "slugify";

export function slugify(text: string): string {
  return slugifyLib(text, {
    lower: true,
    strict: true,
    trim: true,
  });
}

export function generateProductSku(
  categorySlug: string,
  origin: string,
  texture: string,
  index: number
): string {
  const cat = categorySlug.slice(0, 3).toUpperCase();
  const ori = origin.slice(0, 2).toUpperCase();
  const tex = texture.slice(0, 2).toUpperCase();
  const num = String(index).padStart(4, "0");
  return `RH-${cat}-${ori}${tex}-${num}`;
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RH${timestamp}${random}`;
}

export function generateBookingRef(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BK${year}${month}-${random}`;
}

export function generateReturnRef(): string {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `RT-${timestamp}-${random}`;
}
