export type DeliveryLookup = { fee: number | null; invalidConfiguration: boolean };

export function lookupDeliveryFee(city: string, rawRules = process.env.NEXT_PUBLIC_DELIVERY_FEES ?? ""): DeliveryLookup {
  if (!rawRules.trim()) return { fee: null, invalidConfiguration: false };

  let rules: unknown;
  try {
    rules = JSON.parse(rawRules);
  } catch {
    return { fee: null, invalidConfiguration: true };
  }
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) {
    return { fee: null, invalidConfiguration: true };
  }

  const entries = Object.entries(rules);
  if (entries.some(([key, value]) => !key.trim() || !Number.isInteger(value) || Number(value) < 0)) {
    return { fee: null, invalidConfiguration: true };
  }
  const normalize = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  const normalizedCity = normalize(city);
  const match = entries.find(([key]) => normalize(key) === normalizedCity);
  return { fee: match ? Number(match[1]) : null, invalidConfiguration: false };
}
