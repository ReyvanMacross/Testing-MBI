import { maskGovernmentId } from "./mask-government-id";

export function maskFamilyCard(value: string | null | undefined) {
  return maskGovernmentId(value, 8, 4);
}
