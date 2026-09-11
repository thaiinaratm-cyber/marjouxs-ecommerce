import type { Config } from "@netlify/functions";
import { processEcommerceOutbox } from "../../lib/checkout/outbox";

export default async function handler() {
  try {
    const result = await processEcommerceOutbox(5);
    return Response.json(result);
  } catch (error) {
    console.error(
      "Ecommerce outbox worker failed",
      error instanceof Error ? error.message : "Unknown error"
    );
    return Response.json({ error: "Outbox processing failed" }, { status: 500 });
  }
}

export const config: Config = {
  schedule: "*/5 * * * *"
};
