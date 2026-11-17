"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { ignoreRecovery } from "@/lib/admin/recovery";
import { z } from "zod";

export async function ignoreRecoveryAction(form: FormData) {
  await requireActiveAdmin();
  const id = z.uuid().safeParse(form.get("id")).data;
  if (!id) redirect("/admin/recuperacao");
  const ignored = await ignoreRecovery(id);
  revalidatePath("/admin/recuperacao");
  redirect(`/admin/recuperacao/${id}?resultado=${ignored ? "ignorado" : "indisponivel"}`);
}
