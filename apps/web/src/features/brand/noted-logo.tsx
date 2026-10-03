"use client";

import Image from "next/image";

export function NotedLogo({
  className,
  sizes,
}: {
  className: string;
  sizes: string;
}) {
  return (
    <Image
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
