export type CategoryBannerContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  badge?: string;
  note?: string;
};

type CategoryBannerPreset = Omit<CategoryBannerContent, "eyebrow"> & {
  eyebrow?: string;
};

type ResolveCategoryBannerInput = {
  categorySlug: string;
  variantSlug?: string;
  eyebrow: string;
  fallbackTitle: string;
  fallbackSubtitle: string;
  image?: string;
  imageAlt?: string;
};

const defaultBadge = "10% OFF no Pix";
const defaultNote = "Peças sob encomenda • confecção em 3 a 5 dias úteis";

// Para adicionar uma foto futuramente, inclua apenas image: "/images/banners/arquivo.webp"
// no preset correspondente. O componente já cuida do enquadramento responsivo.
const categoryBannerPresets: Record<string, CategoryBannerPreset> = {
  "aliancas:ouro-18k-750": {
    title: "Alianças em Ouro 18k",
    subtitle: "Modelos elegantes para eternizar momentos especiais."
  },
  "aliancas:prata-950": {
    title: "Alianças em Prata 950",
    subtitle: "Beleza, brilho e significado para namoro e compromisso."
  },
  "aneis:ouro-18k": {
    title: "Anéis em Ouro 18k",
    subtitle: "Sofisticação e brilho para completar seu visual."
  },
  "aneis:prata-950": {
    title: "Anéis em Prata 950",
    subtitle: "Estilo e elegância em peças versáteis para todas as ocasiões."
  },
  "brincos:ouro-18k": {
    title: "Brincos em Ouro 18k",
    subtitle: "Sofisticação e brilho em cada detalhe."
  },
  "brincos:prata-950": {
    title: "Brincos em Prata 950",
    subtitle: "Delicadeza e estilo para o dia a dia ou ocasiões especiais."
  },
  "correntes:ouro-18k": {
    title: "Correntes em Ouro 18k",
    subtitle: "Clássicas e elegantes, para presentear ou usar sempre."
  },
  "correntes:prata-925": {
    title: "Correntes em Prata 925",
    subtitle: "Versatilidade e elegância para diferentes combinações."
  },
  "pulseiras:ouro-18k": {
    title: "Pulseiras em Ouro 18k",
    subtitle: "Detalhes sofisticados para todos os momentos."
  },
  "pulseiras:prata-925": {
    title: "Pulseiras em Prata 925",
    subtitle: "Peças versáteis e sofisticadas para combinar com tudo."
  },
  "braceletes:ouro-18k": {
    title: "Braceletes em Ouro 18k",
    subtitle: "Presença e sofisticação em peças marcantes."
  },
  "braceletes:prata-950": {
    title: "Braceletes em Prata 950",
    subtitle: "Design elegante para composições modernas."
  },
  "pingentes:ouro-18k": {
    title: "Pingentes em Ouro 18k",
    subtitle: "Peças cheias de significado para eternizar momentos."
  },
  "pingentes:prata-950": {
    title: "Pingentes em Prata 950",
    subtitle: "Delicadeza, simbolismo e beleza em cada detalhe."
  },
  formatura: {
    title: "Joias de Formatura",
    subtitle: "Celebre uma grande conquista com uma joia especial."
  },
  infantil: {
    title: "Linha Infantil",
    subtitle: "Peças delicadas e encantadoras para momentos especiais."
  },
  "banhado-a-ouro": {
    title: "Joias Banhadas",
    subtitle: "Estilo e elegância em modelos para diferentes ocasiões."
  },
  moeda: {
    title: "Joias em Moeda",
    subtitle: "Modelos marcantes e versáteis para o dia a dia."
  }
};

function normalizeBannerKey(value: string) {
  return value.trim().toLowerCase();
}

export function getCategoryBanner({
  categorySlug,
  variantSlug,
  eyebrow,
  fallbackTitle,
  fallbackSubtitle,
  image,
  imageAlt
}: ResolveCategoryBannerInput): CategoryBannerContent {
  const normalizedCategory = normalizeBannerKey(categorySlug);
  const normalizedVariant = variantSlug ? normalizeBannerKey(variantSlug) : "";
  const preset = normalizedVariant
    ? categoryBannerPresets[`${normalizedCategory}:${normalizedVariant}`] ?? categoryBannerPresets[normalizedVariant]
    : undefined;

  return {
    eyebrow: preset?.eyebrow ?? eyebrow,
    title: preset?.title ?? fallbackTitle,
    subtitle: preset?.subtitle ?? fallbackSubtitle,
    description: preset?.description,
    image: preset?.image ?? image,
    imageAlt: preset?.imageAlt ?? imageAlt,
    badge: preset?.badge ?? defaultBadge,
    note: preset?.note ?? defaultNote
  };
}
