// Client-side image downscale before upload. iPhone camera photos are 3–5 MB;
// one decode produces both the full (1200px) and thumbnail (600px) JPEGs plus
// the dimensions the journal uses to lay photos out at their real shape.

export interface PreparedImage {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

async function decode(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // The decoded bitmap stays usable after the URL is revoked.
    URL.revokeObjectURL(url);
  }
}

function toJpeg(img: HTMLImageElement, maxDim: number, quality: number): Promise<{ blob: Blob | null; w: number; h: number }> {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve({ blob: null, w, h });
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve({ blob, w, h }), "image/jpeg", quality));
}

export async function prepareImage(file: Blob): Promise<PreparedImage> {
  if (typeof document === "undefined" || !file.type.startsWith("image/")) {
    return { full: file, thumb: file, width: 0, height: 0 };
  }
  try {
    const img = await decode(file);
    const [full, thumb] = await Promise.all([toJpeg(img, 1200, 0.82), toJpeg(img, 600, 0.72)]);
    return {
      // Only use the re-encode if it's actually smaller.
      full: full.blob && full.blob.size < file.size ? full.blob : file,
      thumb: thumb.blob ?? file,
      width: full.w,
      height: full.h,
    };
  } catch {
    return { full: file, thumb: file, width: 0, height: 0 };
  }
}

// Legacy helper for the one-off thumbnail backfill in Profile.
export async function compressImage(file: Blob, maxDim = 1200, quality = 0.82): Promise<Blob> {
  if (typeof document === "undefined" || !file.type.startsWith("image/")) return file;
  try {
    const img = await decode(file);
    const { blob } = await toJpeg(img, maxDim, quality);
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
