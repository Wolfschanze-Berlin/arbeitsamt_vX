"use client";

import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const ServerDetailShell = dynamic(
  () =>
    import("@/components/dashboard/servers/ServerDetailShell").then(
      (mod) => mod.ServerDetailShell,
    ),
  { ssr: false },
);

export default function ServerDetailPage() {
  const searchParams = useSearchParams();
  const host = searchParams.get("host") ?? "";

  if (!host) return null;

  return <ServerDetailShell host={host} />;
}
