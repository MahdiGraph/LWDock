/** Shared between server and client: turns Leaseweb locations into countries and flags. */

/** Leaseweb data centers are named after the city: AMS-01, FRA-10, WDC-02… */
const CITY_COUNTRY: Record<string, string> = {
  AMS: "NL", RTM: "NL", EIN: "NL", HAA: "NL",
  FRA: "DE", BER: "DE", DUS: "DE", HAM: "DE", MUC: "DE",
  LON: "GB", MAN: "GB",
  PAR: "FR", MRS: "FR",
  BRU: "BE", LUX: "LU", ZRH: "CH", GVA: "CH", VIE: "AT", MAD: "ES", BCN: "ES", MIL: "IT",
  STO: "SE", OSL: "NO", CPH: "DK", HEL: "FI", WAW: "PL", PRG: "CZ", DUB: "IE", LIS: "PT", IST: "TR",
  WDC: "US", NYC: "US", SFO: "US", LAX: "US", DAL: "US", PHX: "US", MIA: "US", CHI: "US", SEA: "US",
  ATL: "US", DEN: "US", SJC: "US", LAS: "US", BOS: "US",
  MTL: "CA", TOR: "CA", YTO: "CA", VAN: "CA",
  SIN: "SG", HKG: "HK", TYO: "JP", OSA: "JP", SYD: "AU", MEL: "AU", SEL: "KR", BOM: "IN", DEL: "IN",
  SAO: "BR", DXB: "AE", JNB: "ZA",
}

/** Leaseweb Public Cloud regions. */
const REGION_COUNTRY: Record<string, string> = {
  "eu-west-3": "NL",
  "eu-central-1": "DE",
  "eu-west-2": "GB",
  "us-east-1": "US",
  "us-west-1": "US",
  "ca-central-1": "CA",
  "ap-southeast-1": "SG",
  "ap-northeast-1": "JP",
  "ap-southeast-2": "AU",
}

export function countryFor(place: { site?: string | null; datacenter?: string | null; region?: string | null }): string | null {
  for (const code of [place.site, place.datacenter]) {
    const city = code?.trim().slice(0, 3).toUpperCase()
    if (city && CITY_COUNTRY[city]) return CITY_COUNTRY[city]
  }
  const region = place.region?.trim().toLowerCase()
  if (!region) return null
  if (REGION_COUNTRY[region]) return REGION_COUNTRY[region]
  if (region.startsWith("us-")) return "US"
  if (region.startsWith("ca-")) return "CA"
  return null
}

/** "NL" → 🇳🇱 */
export function flagEmoji(country: string): string {
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export function countryName(country: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(country.toUpperCase()) ?? country
  } catch {
    return country
  }
}
