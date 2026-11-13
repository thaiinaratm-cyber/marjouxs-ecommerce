import "server-only";

const SANDBOX_BASE_URL = "https://sandbox.melhorenvio.com.br";

export function getLocalMelhorEnvioSandboxAccessToken(baseUrl: string): string | null {
  if (
    typeof window !== "undefined" ||
    process.env.NODE_ENV === "production" ||
    process.env.MELHOR_ENVIO_BASE_URL !== SANDBOX_BASE_URL ||
    baseUrl !== SANDBOX_BASE_URL
  ) {
    return null;
  }

  return process.env.MELHOR_ENVIO_LOCAL_SANDBOX_ACCESS_TOKEN?.trim() || null;
}
