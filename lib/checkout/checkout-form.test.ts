import { describe, expect, it } from "vitest";
import {
  formatBrazilianPhone,
  formatCpf,
  formatPostalCode,
  getCheckoutAddressLines,
  getCheckoutRequestErrorMessage,
  normalizeCheckoutCustomer,
  validateCheckoutForm
} from "@/lib/checkout/checkout-form";

const customer = {
  name: "Cliente Marjouxs",
  phone: "(11) 99999-9999",
  email: "cliente@example.com",
  cpf: ""
};

const address = {
  postalCode: "07400-610",
  street: "Avenida Exemplo",
  number: "600",
  complement: "Térreo",
  neighborhood: "Centro",
  city: "Arujá",
  state: "SP"
};

describe("formulário do checkout", () => {
  it("formata CEP, telefone brasileiro e CPF sem exigir código do país", () => {
    expect(formatPostalCode("07400610")).toBe("07400-610");
    expect(formatBrazilianPhone("11999999999")).toBe("(11) 99999-9999");
    expect(formatBrazilianPhone("+55 11 99999-9999")).toBe("(11) 99999-9999");
    expect(formatCpf("12345678901")).toBe("123.456.789-01");
  });

  it("normaliza dados somente para o envio interno e preserva CPF opcional vazio", () => {
    expect(
      normalizeCheckoutCustomer({
        name: "  Cliente Marjouxs  ",
        phone: "(11) 99999-9999",
        email: "  CLIENTE@EXAMPLE.COM ",
        cpf: ""
      })
    ).toEqual({
      name: "Cliente Marjouxs",
      phone: "11999999999",
      email: "cliente@example.com",
      cpf: ""
    });
  });

  it("retorna mensagens específicas para dados inválidos", () => {
    const errors = validateCheckoutForm({
      customer: { name: " ", phone: "1199", email: "email-inválido", cpf: "123" },
      address: { ...address, postalCode: "07400", number: "", state: "S" },
      deliveryMethod: "shipping",
      hasSelectedShipping: false
    });

    expect(errors).toMatchObject({
      name: "Informe seu nome.",
      phone: "Informe um WhatsApp válido.",
      email: "Informe um e-mail válido.",
      cpf: "Informe um CPF válido com 11 números.",
      postalCode: "Informe um CEP válido com 8 números.",
      number: "Informe o número.",
      state: "Informe a sigla do estado com 2 letras.",
      shippingService: "Calcule e selecione uma modalidade de frete."
    });
  });

  it("não exige endereço para retirada e aceita complemento e CPF vazios", () => {
    expect(
      validateCheckoutForm({
        customer,
        address: {
          postalCode: "",
          street: "",
          number: "",
          complement: "",
          neighborhood: "",
          city: "",
          state: ""
        },
        deliveryMethod: "pickup",
        hasSelectedShipping: false
      })
    ).toEqual({});
  });

  it("monta o endereço da revisão sem linhas vazias", () => {
    expect(getCheckoutAddressLines({ ...address, complement: "" })).toEqual([
      "Avenida Exemplo, nº 600",
      "Centro",
      "Arujá - SP",
      "CEP 07400-610"
    ]);
  });

  it("classifica falhas do pedido sem expor detalhes internos", () => {
    expect(getCheckoutRequestErrorMessage("checkout_order_creation_error", 500)).toBe(
      "Não foi possível criar o pedido agora. Tente novamente."
    );
    expect(getCheckoutRequestErrorMessage("infinitepay_link_error", 502)).toContain(
      "ambiente de pagamento"
    );
    expect(getCheckoutRequestErrorMessage("unknown", 503, "detalhe interno")).not.toContain(
      "detalhe interno"
    );
  });
});
