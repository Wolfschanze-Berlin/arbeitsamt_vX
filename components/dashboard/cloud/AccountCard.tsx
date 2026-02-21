"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { CloudAccount } from "@/lib/cloud/types";

interface AccountCardProps {
  account: CloudAccount;
  onRemove: (id: string) => void;
}

const providerLabels: Record<string, string> = {
  Aws: "AWS",
};

export function AccountCard({ account, onRemove }: AccountCardProps) {
  const router = useRouter();

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50 group"
      onClick={() =>
        router.push(`/cloud/detail?id=${encodeURIComponent(account.id)}`)
      }
    >
      <CardHeader className="flex-row items-center justify-between pb-0">
        <div className="flex items-center gap-2 truncate">
          <CardTitle className="truncate text-base">
            {account.displayName}
          </CardTitle>
          <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
            {providerLabels[account.provider] ?? account.provider}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(account.id);
          }}
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        <p className="text-muted-foreground truncate text-sm">
          {account.profileName} &middot; {account.region}
        </p>
        <p className="text-muted-foreground truncate text-xs font-mono">
          {account.accountId}
        </p>
      </CardContent>
    </Card>
  );
}
