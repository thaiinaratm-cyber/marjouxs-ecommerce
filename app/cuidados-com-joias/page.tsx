import { InstitutionalPage } from "@/components/institutional-page";

export const metadata = {
  title: "Cuidados com Joias | Marjouxs"
};

export default function JewelryCarePage() {
  return (
    <InstitutionalPage
      eyebrow="Cuidados"
      title="Cuidados com joias"
      intro="Alguns cuidados simples ajudam a preservar o brilho, o acabamento e a durabilidade das peças."
      sections={[
        {
          title: "Uso diário",
          content: <p>Evite contato com perfumes, cremes, produtos de limpeza, cloro, água do mar e atividades que possam riscar, amassar ou danificar a peça.</p>
        },
        {
          title: "Armazenamento",
          content: <p>Guarde cada joia separadamente, de preferência em embalagem própria, para reduzir atrito, riscos e contato com umidade.</p>
        },
        {
          title: "Limpeza e manutenção",
          content: <p>Quando precisar de limpeza, ajuste, polimento ou avaliação, fale com a equipe da Marjouxs para receber orientação adequada ao material da peça.</p>
        }
      ]}
    />
  );
}
