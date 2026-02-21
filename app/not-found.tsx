"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // SPA fallback: redirect unknown routes to root
    // so the client-side router handles navigation in Tauri
    router.replace("/");
  }, [router]);

  return null;
}
