"use client";

export function NotedLogo({
  className,
  sizes,
}: {
  className: string;
  sizes: string;
}) {
  return (
    <img
      src="/brand/noted-logo.webp"
      alt="Noted"
      width={900}
      height={266}
      sizes={sizes}
      loading="eager"
      draggable={false}
      className={className}
    />
  );
}
