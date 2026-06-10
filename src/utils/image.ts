// Client-side image downscale/compression before upload.
// iPhone camera photos are 3–5 MB; shrinking them to ~1600px JPEG cuts the
// upload time and every subsequent download dramatically. Falls back to the
// original file if the image can't be decoded (e.g. unsupported format).

export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.8
): Promise<File | Blob> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = dataUrl;
    });

    const longest = Math.max(img.width, img.height);
    const scale = Math.min(1, maxDim / longest);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );

    // Only use the compressed result if it's actually smaller.
    if (blob && blob.size < file.size) return blob;
    return file;
  } catch {
    return file;
  }
}
