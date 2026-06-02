import { HelpCard } from "@/components/help-card";

export const metadata = {
  title: "Garantia e Trocas | Antoér Joalheria"
};

export default function WarrantyPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Atendimento e cuidado</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">Garantia e Trocas</h1>
        <div className="mt-6 grid gap-5 text-sm leading-7 text-taupe sm:text-base">
          <p>
            A Antoér Joalheria e Relojoaria oferece garantia para produtos adquiridos em nossa loja, conforme as condições
            de cada peça e serviço.
          </p>
          <p>
            O cliente pode solicitar análise em caso de defeito de fabricação. A peça passará por avaliação técnica e,
            sendo confirmado defeito de fabricação, será realizado reparo, ajuste ou substituição conforme o caso.
          </p>
          <p>
            A garantia não cobre mau uso, quedas, riscos, desgaste natural, contato com produtos químicos, oxidação por
            uso inadequado ou danos causados por terceiros.
          </p>
          <p>
            Para solicitar atendimento, o cliente deve entrar em contato pelo WhatsApp da Antoér e enviar fotos da peça,
            comprovante de compra e descrição do ocorrido.
          </p>
        </div>

        <div className="mt-8 grid gap-3 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
          {[
            "Trocas e ajustes devem ser consultados pelo WhatsApp.",
            "Produtos sob encomenda, personalizados, com gravação ou medidas específicas precisam de avaliação individual.",
            "Serviços de conserto, banho, polimento e gravação possuem condições próprias."
          ].map((item) => (
            <p key={item} className="text-sm leading-6 text-taupe">
              {item}
            </p>
          ))}
        </div>
      </section>
      <HelpCard />
    </>
  );
}
