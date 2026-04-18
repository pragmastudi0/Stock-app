import type { SupabaseClient } from "@supabase/supabase-js";

export const PRODUCT_IMAGES_BUCKET = "stock-app-product-images";

export async function uploadProductImage(
  client: SupabaseClient,
  productId: string,
  file: File,
): Promise<string> {
  const ext =
    file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
    "jpg";
  const path = `${productId}/${Date.now()}.${ext}`;
  const { error } = await client.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  const { data } = client.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
