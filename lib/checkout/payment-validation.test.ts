import { describe, expect, it } from "vitest";
import { evaluatePaymentAmounts } from "@/lib/checkout/payment-validation";

const check = {
  success: true, paid: true, amount: 100000, paid_amount: 100000,
  capture_method: "pix", installments: 1
};

describe("verified payment amount policy", () => {
  it.each(["pix", "credit_card"])("allows the exact base for %s", capture_method => {
    expect(evaluatePaymentAmounts(100000,{ ...check,capture_method })).toEqual({ status: "confirm" });
  });

  it.each([90000,89999,90001,1,110000])("Pix paid_amount=%i is reviewed, never inferred from the UI's 10 percent", paid_amount => {
    expect(evaluatePaymentAmounts(100000,{ ...check,paid_amount })).toMatchObject({ status: "requires_review" });
  });

  it.each([90000,99999,100001,110000,1])("card paid_amount=%i is reviewed without a verified fee/discount rule", paid_amount => {
    expect(evaluatePaymentAmounts(100000,{ ...check,paid_amount,capture_method:"credit_card" }))
      .toMatchObject({ status:"requires_review",code:"payment_paid_amount_mismatch" });
  });

  it("does not trust undocumented discount fields", () => {
    expect(evaluatePaymentAmounts(100000,{ ...check,paid_amount:90000,discount:10,discount_percent:10 }))
      .toMatchObject({ status:"requires_review",code:"payment_pix_discount_unverified" });
  });

  it("base mismatch wins even if paid_amount matches the requested value", () => {
    expect(evaluatePaymentAmounts(100000,{ ...check,amount:90000 }))
      .toMatchObject({ status:"requires_review",code:"payment_amount_mismatch" });
  });

  it.each(["cash", "debit_card", null, undefined])("unknown capture method %j never confirms", capture_method => {
    expect(evaluatePaymentAmounts(100000,{ ...check,capture_method }))
      .toMatchObject({ status:"requires_review",code:"payment_method_invalid" });
  });

  it.each([0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,"100000",true,null])("invalid paid cents %j are reviewed", paid_amount => {
    expect(evaluatePaymentAmounts(100000,{ ...check,paid_amount }))
      .toMatchObject({ status:"requires_review",code:"payment_paid_amount_invalid" });
  });

  it.each([0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,true,null,"1e5","100000.0"])('invalid stored total %j is reviewed', expected => {
    expect(evaluatePaymentAmounts(expected,check)).toMatchObject({ status:"requires_review",code:"payment_expected_amount_invalid" });
  });

  it("supports exact decimal bigint serialization from PostgreSQL without floating-point parsing", () => {
    expect(evaluatePaymentAmounts("100000",check)).toEqual({ status:"confirm" });
  });

  it.each([0,2,12,13,1.5,"1"])("Pix installments %j are invalid", installments => {
    expect(evaluatePaymentAmounts(100000,{ ...check,installments }))
      .toMatchObject({ status:"requires_review",code:"payment_installments_invalid" });
  });

  it.each([1,2,6,12])("card installments %i with exact amount is eligible", installments => {
    expect(evaluatePaymentAmounts(100000,{ ...check,installments,capture_method:"credit_card" })).toEqual({ status:"confirm" });
  });

  it("does not round financial inputs or allow a one-cent tolerance", () => {
    const oddBase = { ...check,amount:100001,paid_amount:100001 };
    expect(evaluatePaymentAmounts(100001,oddBase)).toEqual({ status:"confirm" });
    for (const paid_amount of [100000,100002,90000,90001,90000.9]) {
      expect(evaluatePaymentAmounts(100001,{ ...oddBase,paid_amount })).toMatchObject({ status:"requires_review" });
    }
  });

  it.each([{success:false},{paid:false},{success:"true"},{paid:"true"}])("non-confirmed flags %j cannot confirm", flags => {
    expect(evaluatePaymentAmounts(100000,{ ...check,...flags })).toEqual({ status:"not_confirmed" });
  });
});
