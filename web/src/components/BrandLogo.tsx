export function BrandLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const isSm = size === 'sm';
  return (
    <span className="inline-flex items-baseline gap-1.5 select-none">
      <span
        className={`font-display font-extrabold tracking-[-0.04em] text-[var(--text-primary)] ${
          isSm ? 'text-lg' : 'text-xl'
        }`}
      >
        sigma
      </span>
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
      />
      <span
        className={`font-display font-medium tracking-[-0.02em] text-[var(--text-secondary)] ${
          isSm ? 'text-lg' : 'text-xl'
        }`}
      >
        music
      </span>
    </span>
  );
}
