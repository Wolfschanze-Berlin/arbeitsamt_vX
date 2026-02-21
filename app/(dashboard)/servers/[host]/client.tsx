"use client";

import dynamic from "next/dynamic";

const ServerDetailShell = dynamic(
  () =>
    import("@/components/dashboard/servers/ServerDetailShell").then(
      (mod) => mod.ServerDetailShell,
    ),
  { ssr: false },
);

interface ServerDetailClientProps {
  host: string;
}

function ServerDetailClient({ host }: ServerDetailClientProps) {
  return <ServerDetailShell host={host} />;
}

export { ServerDetailClient };
