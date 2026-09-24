/**
 * Shrinks an image in the browser before upload (slow mobile internet, PLAN.md §5).
 * Output is WebP, at most `maxSize` px on the longest side.
 */
export async function compressImage(file: File, maxSize = 512, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) throw new Error("Image compression failed");
  return blob;
}
