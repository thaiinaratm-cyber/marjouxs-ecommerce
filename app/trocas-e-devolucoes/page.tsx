import { InstitutionalPage } from "@/components/institutional-page";

export const metadata = {
  title: "Trocas e Devoluções | Marjouxs"
};

export default function ExchangesAndReturnsPage() {
  return (
    <InstitutionalPage
      eyebrow="Atendimento"
      title="Trocas e devoluções"
      intro="Solicitações de troca, devolução ou ajuste são avaliadas pela equipe da Marjouxs conforme o produto e as condições da peça."
      sections={[
        {
          title: "Como solicitar",
          content: <p>Entre em contato pelo WhatsApp oficial da Marjouxs com o número do pedido, fotos da peça e uma breve descrição da solicitação.</p>
        },
        {
          title: "Peças personalizadas",
          content: <p>Produtos sob encomenda, personalizados, com gravação ou medidas específicas dependem de avaliação individual antes de qualquer procedimento.</p>
        },
        {
          title: "Análise da peça",
          content: <p>A equipe poderá solicitar a avaliação da peça para orientar o melhor caminho, incluindo ajuste, reparo ou outra solução aplicável ao caso.</p>
        }
      ]}
    />
  );
}
