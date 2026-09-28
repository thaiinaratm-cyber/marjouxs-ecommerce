export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

export class SupabasePublicConfigError extends Error {
  constructor() {
    super("Supabase public configuration is missing or invalid.");
    this.name = "SupabasePublicConfigError";
  }
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new SupabasePublicConfigError();
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
      throw new SupabasePublicConfigError();
    }
  } catch {
    throw new SupabasePublicConfigError();
  }

  return { url, anonKey };
}
