export function BrandLink({ href }: { href: string }) {
  return (
    <a className="wordmark" href={href} aria-label="Noted playground">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      noted<span className="brand-dot">.</span>
    </a>
  );
}
