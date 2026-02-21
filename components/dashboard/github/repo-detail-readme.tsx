"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useRepoReadme } from "@/hooks/useGithub";
import { ChevronDown, FileText } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

interface Props {
  owner: string;
  repo: string;
}

export function RepoDetailReadme({ owner, repo }: Props) {
  const [open, setOpen] = useState(false);
  const { data: readme, isLoading, error } = useRepoReadme(owner, repo);

  const hasReadme = !error && readme?.content;

  return (
    <div className="rounded-2xl border bg-card">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-5 text-left md:p-6">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">README</span>
            {!isLoading && !hasReadme && (
              <span className="text-xs text-muted-foreground">
                — No README found
              </span>
            )}
          </div>
          {(isLoading || hasReadme) && (
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200"
              style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-5 py-4 md:px-6">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : hasReadme ? (
              <div className="text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline-offset-2 [&_a:hover]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_h1]:mb-3 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_hr]:my-4 [&_hr]:border-border [&_li]:my-0.5 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_ul]:ml-5 [&_ul]:list-disc">
                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                  {readme.content}
                </ReactMarkdown>
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
