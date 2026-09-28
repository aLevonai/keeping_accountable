"use client";

import { useState } from "react";
import { useSignedUrl, requestSignedUrl } from "@/lib/photo-urls";
import { thumbPath } from "@/utils/storage";

// Private-bucket photo. Prefers the 600px thumbnail when `thumb` is set and
// recovers on error: first re-sign the URL (it may have expired), then fall
// back to the full-size file (older photos have no thumbnail).
export function Photo({
  path,
  thumb = false,
  alt = "",
  className,
  style,
  eager = false,
  onLoad,
}: {
  path: string;
  thumb?: boolean;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  eager?: boolean;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  const [useFull, setUseFull] = useState(!thumb);
  const [resigned, setResigned] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const activePath = useFull ? path : thumbPath(path);
  const src = useSignedUrl(activePath);

  function handleError() {
    if (resigned !== activePath) {
      setResigned(activePath);
      requestSignedUrl(activePath, true);
    } else if (!useFull) {
      setUseFull(true);
    }
  }

  if (!src) return <div className={className} style={style} aria-hidden />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={className}
      style={{ ...style, opacity: loaded ? 1 : 0, transition: "opacity 180ms ease-out" }}
      onLoad={(e) => { setLoaded(true); onLoad?.(e); }}
      onError={handleError}
    />
  );
}
