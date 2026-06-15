import { InstitutionalPage } from "@/components/institutional-page";

export const metadata = {
  title: "Política de Pagamento | Marjouxs"
};

export default function PaymentPolicyPage() {
  return (
    <InstitutionalPage
      eyebrow="Pagamento"
      title="Política de pagamento"
      intro="As condições de pagamento podem variar conforme produto, material, disponibilidade e forma escolhida pelo cliente."
      sections={[
        {
          title: "Formas de pagamento",
          content: <p>A Marjouxs trabalha com Pix, cartão de débito e cartão de crédito. As condições finais são confirmadas diretamente com a equipe pelo WhatsApp.</p>
        },
        {
          title: "Parcelamento",
          content: <p>Quando houver parcelamento disponível, a quantidade de parcelas e valores aparecem no produto ou são confirmados no atendimento, conforme as regras da loja.</p>
        },
        {
          title: "Confirmação do pedido",
          content: <p>Após o envio do pedido pelo site, a equipe da Marjouxs confirma os dados, a disponibilidade e a melhor forma de seguir com o pagamento.</p>
        }
      ]}
    />
  );
}
