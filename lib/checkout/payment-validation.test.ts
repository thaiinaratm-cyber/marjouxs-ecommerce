import { describe, expect, it } from "vitest";
import { evaluatePaymentAmounts } from "@/lib/checkout/payment-validation";

const check = {
  success: true, paid: true, amount: 16000, paid_amount: 16000,
  capture_method: "pix", installments: 1
};

describe("verified payment amount policy", () => {
  it.each(["pix", "credit_card"])("allows the exact base for %s", capture_method => {
    expect(evaluatePaymentAmounts(16000,{ ...check,capture_method })).toEqual({ status: "confirm" });
  });

  it.each([14400,14401])("accepts the official Pix paid_amount=%i without inferring a discount", paid_amount => {
    expect(evaluatePaymentAmounts(16000,{ ...check,paid_amount })).toEqual({ status:"confirm" });
  });

  it.each([15200,16800])("accepts the official card paid_amount=%i without assuming a fee", paid_amount => {
    expect(evaluatePaymentAmounts(16000,{ ...check,paid_amount,capture_method:"credit_card" }))
      .toEqual({ status:"confirm" });
  });

  it.each([15999,16001,undefined,"16000",16000.5])("rejects an invalid or different original charge %j", amount => {
    expect(evaluatePaymentAmounts(16000,{ ...check,amount,paid_amount:14400 }))
      .toMatchObject({ status:"requires_review",code:"payment_amount_mismatch" });
  });

  it.each(["cash", "debit_card", null, undefined])("unknown capture method %j never confirms", capture_method => {
    expect(evaluatePaymentAmounts(16000,{ ...check,capture_method }))
      .toMatchObject({ status:"requires_review",code:"payment_method_invalid" });
  });

  it.each([0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,"16000",true,null,undefined])("invalid paid cents %j are reviewed", paid_amount => {
    expect(evaluatePaymentAmounts(16000,{ ...check,paid_amount }))
      .toMatchObject({ status:"requires_review",code:"payment_paid_amount_invalid" });
  });

  it.each([0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,true,null,"1e5","100000.0"])('invalid stored total %j is reviewed', expected => {
    expect(evaluatePaymentAmounts(expected,check)).toMatchObject({ status:"requires_review",code:"payment_expected_amount_invalid" });
  });

  it("supports exact decimal bigint serialization from PostgreSQL without floating-point parsing", () => {
    expect(evaluatePaymentAmounts("16000",check)).toEqual({ status:"confirm" });
  });

  it.each([0,2,12,13,1.5,"1"])("Pix installments %j are invalid", installments => {
    expect(evaluatePaymentAmounts(16000,{ ...check,installments }))
      .toMatchObject({ status:"requires_review",code:"payment_installments_invalid" });
  });

  it.each([1,2,6,12])("card installments %i with exact amount is eligible", installments => {
    expect(evaluatePaymentAmounts(16000,{ ...check,installments,capture_method:"credit_card" })).toEqual({ status:"confirm" });
  });

  it("uses the reported integer cents without calculating a rounded Pix price", () => {
    const oddBase = { ...check,amount:19999,paid_amount:17999 };
    expect(evaluatePaymentAmounts(19999,oddBase)).toEqual({ status:"confirm" });
    expect(evaluatePaymentAmounts(19999,{ ...oddBase,paid_amount:17999.1 }))
      .toMatchObject({ status:"requires_review",code:"payment_paid_amount_invalid" });
  });

  it.each([{success:false},{paid:false},{success:"true"},{paid:"true"}])("non-confirmed flags %j cannot confirm", flags => {
    expect(evaluatePaymentAmounts(16000,{ ...check,...flags })).toEqual({ status:"not_confirmed" });
  });
});
