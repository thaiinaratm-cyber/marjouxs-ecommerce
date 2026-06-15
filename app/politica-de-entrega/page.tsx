import { InstitutionalPage } from "@/components/institutional-page";

export const metadata = {
  title: "Política de Entrega | Marjouxs"
};

export default function DeliveryPolicyPage() {
  return (
    <InstitutionalPage
      eyebrow="Entrega e retirada"
      title="Política de entrega"
      intro="A forma de recebimento é combinada com a equipe da Marjouxs de acordo com o produto e a preferência do cliente."
      sections={[
        {
          title: "Entrega combinada",
          content: <p>Quando houver entrega, prazo, endereço, disponibilidade e eventuais condições são confirmados diretamente pelo atendimento da Marjouxs.</p>
        },
        {
          title: "Retirada na loja",
          content: <p>O cliente também pode combinar retirada na loja, após confirmação do pedido e disponibilidade do produto pela equipe.</p>
        },
        {
          title: "Produtos sob encomenda",
          content: <p>Itens personalizados ou sob encomenda podem exigir confirmação individual de prazo antes da finalização.</p>
        }
      ]}
    />
  );
}
