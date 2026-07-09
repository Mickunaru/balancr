"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { syncAllItems } from "@/lib/sync";

export async function syncNow() {
  const session = await auth();
  if (!session?.user?.id) return;

  await syncAllItems(session.user.id);
  revalidatePath("/dashboard", "layout");
}
