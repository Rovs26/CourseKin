import { cookies, headers } from "next/headers";
import { CookieBannerClient } from "./cookie-banner-client";

// EU/EEA + UK + Switzerland country codes (ISO 3166-1 alpha-2)
const EU_COUNTRY_CODES = new Set([
  // EU27
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EEA
  "IS", "LI", "NO",
  // UK + Switzerland (equivalent frameworks)
  "GB", "CH",
]);

export async function CookieBanner() {
  const headerStore = await headers();
  const cookieStore = await cookies();

  const country = headerStore.get("cf-ipcountry") ?? "";
  const isEU = EU_COUNTRY_CODES.has(country.toUpperCase());

  // If consent cookie already set, nothing to show
  const existingConsent = cookieStore.get("reviewflow-consent")?.value;
  if (existingConsent) return null;

  // Non-EU users: no banner required
  if (!isEU) return null;

  return <CookieBannerClient />;
}
