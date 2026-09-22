import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/access";

export default async function AdminUsersRedirect() {
  await requireAdmin();
  redirect("/users");
}
