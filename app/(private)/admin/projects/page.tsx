import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/access";

export default async function AdminProjectsRedirect() {
  await requireAdmin();
  redirect("/projects/manage");
}
