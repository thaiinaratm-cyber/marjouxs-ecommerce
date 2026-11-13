export const POSTAL_CODE_MESSAGES = {
  invalid: "Informe um CEP válido com 8 números.",
  notFound: "CEP não encontrado. Confira os números informados.",
  unavailable: "Não foi possível validar o CEP agora. Tente novamente em instantes."
} as const;

export function normalizePostalCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{5}-?\d{3}$/.test(trimmed) ? trimmed.replace("-", "") : null;
}
