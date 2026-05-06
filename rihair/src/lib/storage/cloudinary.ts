import { v2 as cloudinary } from "cloudinary";
import { logger } from "@/lib/logger";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export type UploadResult = {
  publicId: string;
  url: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
};

export async function uploadProductImage(
  file: string | Buffer,
  productSlug: string
): Promise<UploadResult> {
  const result = await cloudinary.uploader.upload(
    typeof file === "string" ? file : `data:image/jpeg;base64,${file.toString("base64")}`,
    {
      folder: `rihair/products/${productSlug}`,
      transformation: [
        { quality: "auto:best", fetch_format: "auto" },
        { width: 2000, height: 2000, crop: "limit" },
      ],
      tags: ["product", productSlug],
    }
  );

  return {
    publicId: result.public_id,
    url: result.url,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  };
}

export async function uploadReviewMedia(
  file: string,
  userId: string
): Promise<UploadResult> {
  const result = await cloudinary.uploader.upload(file, {
    folder: `rihair/reviews/${userId}`,
    resource_type: "auto",
    transformation: [{ quality: "auto", fetch_format: "auto" }],
    max_bytes: 50 * 1024 * 1024,
  });

  return {
    publicId: result.public_id,
    url: result.url,
    secureUrl: result.secure_url,
    width: result.width ?? 0,
    height: result.height ?? 0,
    format: result.format,
    bytes: result.bytes,
  };
}

export async function deleteCloudinaryAsset(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    logger.error("Failed to delete Cloudinary asset", err, { publicId });
  }
}

export function buildCloudinaryUrl(
  publicId: string,
  options?: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string;
  }
): string {
  return cloudinary.url(publicId, {
    transformation: [
      {
        width: options?.width,
        height: options?.height,
        crop: options?.crop ?? "fill",
        gravity: "auto",
        quality: options?.quality ?? "auto:good",
        fetch_format: "auto",
      },
    ],
    secure: true,
  });
}
