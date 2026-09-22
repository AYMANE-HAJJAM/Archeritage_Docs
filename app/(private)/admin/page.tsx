import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/access";

/** Legacy admin hub — unified platform uses Projets / Structure / Utilisateurs. */
export default async function AdminRedirectPage() {
  await requireAdmin();
  redirect("/projects/manage");
}
