"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) { return <section className="py-16"><h1 className="archive-title text-3xl">Le fonds est momentanément indisponible.</h1><p className="my-5 text-muted-foreground">Veuillez réessayer dans quelques instants.</p><Button onClick={reset}>Réessayer</Button></section>; }
