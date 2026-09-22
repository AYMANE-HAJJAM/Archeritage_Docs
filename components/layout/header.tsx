import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { Brand } from "./brand";
import { Button } from "@/components/ui/button";
export function Header({ user }: { user: { name: string; email: string } }) {
  return <header className="border-b bg-background"><div className="mx-auto flex min-h-24 max-w-7xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 md:px-10">
    <Link href="/projects" aria-label="ARCHERITAGE Docs — Accueil"><Brand /></Link>
    <nav className="ml-2"><Link href="/projects" className="border-b border-primary pb-2 text-sm font-medium">Territoires</Link></nav>
    <div className="ml-auto flex items-center gap-4"><span className="hidden text-right sm:block"><span className="block text-sm">{user.name}</span><span className="block text-xs text-muted-foreground">{user.email}</span></span><form action={logout}><Button variant="ghost" size="icon" title="Se déconnecter" aria-label="Se déconnecter"><LogOut /></Button></form></div>
  </div></header>;
}
