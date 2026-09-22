"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toast";

/** Shows a one-shot success toast when redirected after account activation. */
export function ActivatedToastListener() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { pushToast } = useToast();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    if (params.get("activated") !== "1") return;
    handled.current = true;
    pushToast("Compte activé avec succès.", "success");
    const next = new URLSearchParams(params.toString());
    next.delete("activated");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [params, pathname, pushToast, router]);

  return null;
}
