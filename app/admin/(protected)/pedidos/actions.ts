"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { changeAdminOrderStatus } from "@/lib/admin/orders";
import { saveAdminShipment } from "@/lib/admin/order-shipment";
import { isOrderStatus } from "@/lib/orders/model";
import { reconcileAdminOrderPayment } from "@/lib/admin/reconcile-payment";

export async function updateOrderStatusAction(form: FormData) {
  await requireActiveAdmin();
  const id = z.string().uuid().safeParse(form.get("id"));
  const status = String(form.get("status") ?? "");
  if (!id.success) redirect("/admin/pedidos");
  if (!isOrderStatus(status)) redirect(`/admin/pedidos/${id.data}?result=invalid`);
  const result = await changeAdminOrderStatus(id.data, status, String(form.get("expectedStatus") ?? ""));
  if (result === "saved") {
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${id.data}`);
  }
  redirect(`/admin/pedidos/${id.data}?result=${result}`);
}

export async function reconcilePaymentAction(form: FormData) {
  await requireActiveAdmin();
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) redirect("/admin/pedidos");
  const result = await reconcileAdminOrderPayment(id.data);
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${id.data}`);
  redirect(`/admin/pedidos/${id.data}?result=${result}`);
}

export async function updateOrderShipmentAction(form: FormData) {
  await requireActiveAdmin();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) redirect("/admin/pedidos");
  const result = await saveAdminShipment({
    id: id.data,
    expectedUpdatedAt: form.get("expectedUpdatedAt"),
    carrier: form.get("carrier"),
    code: form.get("code"),
    url: form.get("url"),
    status: form.get("shippingStatus"),
    confirmDelivered: form.get("confirmDelivered") === "on"
  });
  if (result === "saved") {
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${id.data}`);
  }
  redirect(`/admin/pedidos/${id.data}?result=shipment_${result}#envio-e-rastreamento`);
}
