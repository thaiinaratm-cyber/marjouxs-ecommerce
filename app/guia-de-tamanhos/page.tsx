import { InstitutionalPage } from "@/components/institutional-page";

export const metadata = {
  title: "Guia de Tamanhos | Marjouxs"
};

export default function SizeGuidePage() {
  return (
    <InstitutionalPage
      eyebrow="Medidas"
      title="Guia de tamanhos"
      intro="A escolha correta do tamanho ajuda a evitar ajustes e garante mais conforto no uso da peça."
      sections={[
        {
          title: "Anéis e alianças",
          content: <p>Para anéis e alianças, informe a numeração do aro no atendimento. Se tiver dúvida, a equipe da Marjouxs pode orientar a melhor forma de confirmar a medida.</p>
        },
        {
          title: "Correntes, pulseiras e outros itens",
          content: <p>Medidas de correntes, pulseiras, pingentes e outros produtos devem ser conferidas conforme a descrição da peça ou confirmadas pelo WhatsApp.</p>
        },
        {
          title: "Peças sob encomenda",
          content: <p>Produtos personalizados ou sob encomenda podem exigir confirmação individual de medidas antes da produção.</p>
        }
      ]}
    />
  );
}
