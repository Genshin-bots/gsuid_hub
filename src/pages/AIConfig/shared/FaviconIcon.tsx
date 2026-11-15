export function FaviconIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      width={14}
      height={14}
      className="h-3.5 w-3.5 shrink-0 rounded-[2px] object-contain"
      draggable={false}
    />
  );
}
