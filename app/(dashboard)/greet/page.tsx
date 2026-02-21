"use client";

import { useState } from "react";
import { tauriInvoke } from "@/lib/tauri";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function GreetPage() {
  const [name, setName] = useState("");
  const [greeting, setGreeting] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const result = await tauriInvoke<string>("greet", { name });
      setGreeting(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to invoke Tauri command"
      );
    }
  }

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Tauri Greet Demo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name..."
            />
            <Button type="submit">Greet</Button>
          </form>

          {greeting && (
            <p className="mt-4 rounded-md bg-muted p-3 text-sm">{greeting}</p>
          )}

          {error && (
            <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
