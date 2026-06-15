import { InstitutionalPage } from "@/components/institutional-page";

export const metadata = {
  title: "Termo de Garantia | Marjouxs"
};

export default function WarrantyTermPage() {
  return (
    <InstitutionalPage
      eyebrow="Garantia"
      title="Termo de garantia"
      intro="A garantia é analisada conforme o tipo de produto, serviço realizado e condição apresentada pela peça."
      sections={[
        {
          title: "Cobertura",
          content: <p>A garantia pode cobrir defeitos de fabricação, mediante avaliação técnica da peça e confirmação pela equipe da Marjouxs.</p>
        },
        {
          title: "Itens não cobertos",
          content: <p>Não são cobertos danos por mau uso, quedas, riscos, desgaste natural, contato com produtos químicos, oxidação por uso inadequado ou intervenção de terceiros.</p>
        },
        {
          title: "Atendimento",
          content: <p>Para solicitar análise, envie fotos da peça, comprovante de compra e descrição do ocorrido pelo WhatsApp oficial da Marjouxs.</p>
        }
      ]}
    />
  );
}
