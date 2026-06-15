import { InstitutionalPage } from "@/components/institutional-page";

export const metadata = {
  title: "Política de Privacidade | Marjouxs"
};

export default function PrivacyPolicyPage() {
  return (
    <InstitutionalPage
      eyebrow="Privacidade"
      title="Política de privacidade"
      intro="Esta página resume como a Marjouxs utiliza informações enviadas pelo cliente durante o atendimento e a compra."
      sections={[
        {
          title: "Dados utilizados no atendimento",
          content: (
            <>
              <p>Podemos solicitar nome, WhatsApp, e-mail, endereço de entrega, preferência de retirada e informações necessárias para concluir o pedido.</p>
              <p>Esses dados são usados para atendimento, confirmação de produtos, orçamento, entrega, retirada e comunicação sobre a compra.</p>
            </>
          )
        },
        {
          title: "Comunicação",
          content: <p>O contato principal pode acontecer pelo WhatsApp oficial, e-mail ou Instagram da Marjouxs, conforme a solicitação do cliente.</p>
        },
        {
          title: "Proteção das informações",
          content: <p>A Marjouxs busca tratar os dados com cuidado e não utiliza informações do cliente para finalidades alheias ao atendimento da loja.</p>
        }
      ]}
    />
  );
}
