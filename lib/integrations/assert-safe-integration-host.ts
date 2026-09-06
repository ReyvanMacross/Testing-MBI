import dns from "node:dns/promises";

import ipaddr from "ipaddr.js";

import { IntegrationValidationError } from "./validate-integration-url";

type LookupResult = { address: string; family: number };
type Lookup = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<LookupResult[]>;

const BLOCKED_RANGES = new Set([
  "unspecified",
  "broadcast",
  "multicast",
  "linkLocal",
  "loopback",
  "private",
  "carrierGradeNat",
  "reserved",
  "uniqueLocal",
]);

export function isPublicIntegrationAddress(value: string) {
  if (!ipaddr.isValid(value)) return false;

  let address = ipaddr.parse(value);
  if (address instanceof ipaddr.IPv6 && address.isIPv4MappedAddress()) {
    address = address.toIPv4Address();
  }

  return !BLOCKED_RANGES.has(address.range());
}

export async function assertSafeIntegrationHost(
  hostname: string,
  lookup: Lookup = dns.lookup,
) {
  let addresses: LookupResult[];

  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new IntegrationValidationError("Endpoint tidak dapat dihubungi.");
  }

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicIntegrationAddress(address))
  ) {
    throw new IntegrationValidationError(
      "Host endpoint mengarah ke alamat jaringan yang tidak diizinkan.",
    );
  }
}
