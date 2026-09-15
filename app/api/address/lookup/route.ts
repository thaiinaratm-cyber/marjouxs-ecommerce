import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ViaCepResponse = {
  cep?: unknown;
  logradouro?: unknown;
  bairro?: unknown;
  localidade?: unknown;
  uf?: unknown;
  erro?: unknown;
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function unavailableResponse() {
  return NextResponse.json(
    {
      error:
        "Não foi possível consultar o CEP agora. Você pode continuar preenchendo o endereço manualmente.",
      code: "postal_code_service_unavailable"
    },
    { status: 503 }
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const rawPostalCode =
    payload && typeof payload === "object" && "postalCode" in payload
      ? payload.postalCode
      : null;
  const postalCode =
    typeof rawPostalCode === "string" ? rawPostalCode.replace(/\D/g, "") : "";

  if (!/^\d{8}$/.test(postalCode)) {
    return NextResponse.json(
      { error: "Informe um CEP válido com 8 números.", code: "invalid_postal_code" },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(`https://viacep.com.br/ws/${postalCode}/json/`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) return unavailableResponse();

    const body = (await response.json()) as ViaCepResponse;
    if (body.erro === true || body.erro === "true") {
      return NextResponse.json(
        {
          error: "CEP não encontrado. Confira os números ou preencha o endereço manualmente.",
          code: "postal_code_not_found"
        },
        { status: 404 }
      );
    }

    const city = textValue(body.localidade);
    const state = textValue(body.uf).toUpperCase();
    if (!city || !/^[A-Z]{2}$/.test(state)) return unavailableResponse();

    return NextResponse.json({
      address: {
        postalCode,
        street: textValue(body.logradouro),
        neighborhood: textValue(body.bairro),
        city,
        state
      }
    });
  } catch {
    return unavailableResponse();
  } finally {
    clearTimeout(timeout);
  }
}
