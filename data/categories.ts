import type { CategoryName } from "@/types/product";

export type Category = {
  name: CategoryName;
  slug: string;
  description: string;
  subcategories: string[];
};

export const categories: Category[] = [
  {
    name: "Alianças",
    slug: "aliancas",
    description: "Modelos em ouro, prata, namoro, casamento e projetos sob encomenda.",
    subcategories: [
      "Alianças Ouro 18k",
      "Alianças Prata",
      "Alianças Banhado a Ouro",
      "Alianças de Ouro 18k/750",
      "Alianças de Prata",
      "Alianças de Namoro",
      "Alianças de Casamento",
      "Alianças sob encomenda",
      "Aparadores e solitários"
    ]
  },
  {
    name: "Anéis",
    slug: "aneis",
    description: "Anéis femininos, masculinos e solitários com acabamento refinado.",
    subcategories: ["Anéis em Ouro", "Anéis em Prata", "Solitários", "Anéis de Formatura", "Anéis femininos", "Anéis masculinos"]
  },
  {
    name: "Brincos",
    slug: "brincos",
    description: "Peças delicadas para uso diário e ocasiões especiais.",
    subcategories: ["Brincos em Ouro", "Brincos em Prata", "Argolas", "Brincos infantis", "Ponto de luz"]
  },
  {
    name: "Correntes",
    slug: "correntes",
    description: "Correntes em ouro e prata para diferentes estilos.",
    subcategories: ["Correntes em Ouro", "Correntes em Prata", "Correntes masculinas", "Correntes femininas"]
  },
  {
    name: "Pulseiras",
    slug: "pulseiras",
    description: "Pulseiras clássicas, infantis e chapinhas para presente.",
    subcategories: ["Pulseiras em Ouro", "Pulseiras em Prata", "Pulseiras infantis", "Pulseiras chapinha"]
  },
  {
    name: "Pingentes",
    slug: "pingentes",
    description: "Pingentes religiosos, clássicos e personalizados.",
    subcategories: ["Religiosos", "Personalizados", "Ouro", "Prata"]
  },
  {
    name: "Relógios",
    slug: "relogios",
    description: "Relógios e serviços técnicos de relojoaria.",
    subcategories: ["Relógios masculinos", "Relógios femininos", "Manutenção"]
  },
  {
    name: "Serviços",
    slug: "servicos",
    description: "Consertos, ajustes, banho, polimento, gravação e troca de bateria.",
    subcategories: [
      "Conserto de joias",
      "Banho de joias",
      "Polimento",
      "Gravação",
      "Ajuste de alianças",
      "Troca de bateria",
      "Conserto de relógios"
    ]
  }
];
