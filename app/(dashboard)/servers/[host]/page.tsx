import { ServerDetailClient } from "./client";

// Required for static export with dynamic routes. At build time no hosts
// are known -- at runtime Tauri's SPA fallback (404.html) handles
// navigation to /servers/<host>.
// Static export requires at least one param to be generated at build time.
// The placeholder below is never navigated to in practice -- Tauri's SPA
// fallback (404.html) handles runtime navigation to /servers/<actual-host>.
export async function generateStaticParams() {
  return [{ host: "_" }];
}

export default async function ServerDetailPage({
  params,
}: {
  params: Promise<{ host: string }>;
}) {
  const { host } = await params;
  return <ServerDetailClient host={decodeURIComponent(host)} />;
}
