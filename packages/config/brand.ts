export type BrandColors = {
  text: string;
  textMuted: string;
  metaText: string;
  background: string;
  surface: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryForeground: string;
  buttonBackground: string;
  buttonBorderHover: string;
  alertBackground: string;
  alertBorder: string;
  alertText: string;
};

export type BrandLogo = {
  src: string;
  alt: string;
};

export type BrandConfig = {
  storeName: string;
  tagline: string;
  logo?: BrandLogo;
  colors: BrandColors;
};

export const brand: BrandConfig = {
  storeName: "Bitz Bobz",
  tagline: "Barbados-only e-commerce storefront in BBD.",
  logo: {
    src: "/logo.svg",
    alt: "Bitz Bobz"
  },
  colors: {
    text: "#0f172a",
    textMuted: "#334155",
    metaText: "#64748b",
    background: "radial-gradient(circle at 20% 0%, #fef3c7, #f1f5f9 35%, #e2e8f0 100%)",
    surface: "#ffffff",
    border: "#e2e8f0",
    borderStrong: "#cbd5e1",
    primary: "#0f172a",
    primaryForeground: "#ffffff",
    buttonBackground: "#f8fafc",
    buttonBorderHover: "#94a3b8",
    alertBackground: "#fef2f2",
    alertBorder: "#fecaca",
    alertText: "#7f1d1d"
  }
};

export const brandCssVars = {
  "--brand-text": brand.colors.text,
  "--brand-text-muted": brand.colors.textMuted,
  "--brand-meta-text": brand.colors.metaText,
  "--brand-background": brand.colors.background,
  "--brand-surface": brand.colors.surface,
  "--brand-border": brand.colors.border,
  "--brand-border-strong": brand.colors.borderStrong,
  "--brand-primary": brand.colors.primary,
  "--brand-primary-fg": brand.colors.primaryForeground,
  "--brand-button-bg": brand.colors.buttonBackground,
  "--brand-button-hover-border": brand.colors.buttonBorderHover,
  "--brand-alert-bg": brand.colors.alertBackground,
  "--brand-alert-border": brand.colors.alertBorder,
  "--brand-alert-text": brand.colors.alertText
} as const;

