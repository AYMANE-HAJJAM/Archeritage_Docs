import { requireAdmin } from "@/lib/access";

/** Thin gate — management pages share the main AppShell (no separate admin chrome). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return children;
}
