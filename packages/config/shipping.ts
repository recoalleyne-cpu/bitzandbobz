export type ShippingCountry = {
  code: string;
  name: string;
  acceptedInputs: string[];
};

export type ShippingRateConfig = {
  defaultCents: number;
  parishOverrides: Array<{ parishes: string[]; cents: number }>;
};

export type ShippingConfig = {
  allowedCountries: ShippingCountry[];
  defaultCountryCode: string;
  rates: ShippingRateConfig;
};

export const shipping: ShippingConfig = {
  allowedCountries: [
    {
      code: "BB",
      name: "Barbados",
      acceptedInputs: ["BB", "BARBADOS", "BRIDGETOWN"]
    }
  ],
  defaultCountryCode: "BB",
  rates: {
    defaultCents: 1200,
    parishOverrides: [
      { parishes: ["ST. LUCY", "ST. ANDREW", "ST. JOSEPH"], cents: 1600 }
    ]
  }
};

export function normalizeShippingCountry(value: string): string {
  return value.trim().toUpperCase();
}

export function getDefaultShippingCountry(): ShippingCountry {
  return shipping.allowedCountries.find((country) => country.code === shipping.defaultCountryCode) ?? shipping.allowedCountries[0]!;
}

export function isAllowedShippingCountry(input: string): boolean {
  const normalized = normalizeShippingCountry(input);
  return shipping.allowedCountries.some((country) => country.acceptedInputs.includes(normalized));
}

export function calculateShippingCents(parish?: string | null): number {
  if (!parish) return shipping.rates.defaultCents;
  const normalized = parish.trim().toUpperCase();
  for (const override of shipping.rates.parishOverrides) {
    if (override.parishes.includes(normalized)) return override.cents;
  }
  return shipping.rates.defaultCents;
}

