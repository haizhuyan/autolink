const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60";

export const btnPrimary = `${base} bg-accent px-4 py-2 text-accent-fg hover:bg-accent-hover`;
export const btnSecondary = `${base} border border-line-strong bg-card px-4 py-2 text-fg hover:bg-surface`;
export const btnGhost = `${base} px-3 py-2 text-muted hover:bg-raised hover:text-fg`;
export const btnDanger = `${base} border border-danger/40 bg-card px-3 py-2 text-danger-text hover:bg-danger/10`;
