"use client";

import type { UIMessage } from "ai";
import { isToolUIPart, getToolName } from "ai";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { Bot, ChevronRight, User, AlertCircle, Wrench } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: UIMessage;
}

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar size="sm" className="mt-0.5 shrink-0">
        <AvatarFallback
          className={cn(
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-1.5",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          )}
        >
          <MessageParts parts={message.parts} isUser={isUser} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Parts renderer                                                     */
/* ------------------------------------------------------------------ */

function MessageParts({
  parts,
  isUser,
}: {
  parts: UIMessage["parts"];
  isUser: boolean;
}) {
  return (
    <>
      {parts.map((part, i) => (
        <MessagePart key={i} part={part} isUser={isUser} />
      ))}
    </>
  );
}

function MessagePart({
  part,
  isUser,
}: {
  part: UIMessage["parts"][number];
  isUser: boolean;
}) {
  switch (part.type) {
    case "text":
      return <TextPart text={part.text} isUser={isUser} />;
    case "reasoning":
      return <ReasoningPart text={part.text} state={part.state} />;
    case "file":
      return <FilePart url={part.url} mediaType={part.mediaType} />;
    case "step-start":
      return null;
    case "source-url":
      return <SourceUrlPart url={part.url} title={part.title} />;
    default:
      // dynamic-tool or typed tool-* parts
      if (isToolUIPart(part)) {
        const name = getToolName(part);
        return <ToolPart name={name} state={part.state} part={part} />;
      }
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Individual part components                                         */
/* ------------------------------------------------------------------ */

function TextPart({ text, isUser }: { text: string; isUser: boolean }) {
  if (!text) return null;

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        "[&_p]:my-1 [&_pre]:my-2 [&_ul]:my-1 [&_ol]:my-1",
        isUser && "prose-invert"
      )}
    >
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{text}</ReactMarkdown>
    </div>
  );
}

function ReasoningPart({
  text,
  state,
}: {
  text: string;
  state?: "streaming" | "done";
}) {
  if (!text) return null;

  return (
    <Collapsible className="my-1.5">
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90" />
        <span>Reasoning</span>
        {state === "streaming" && <Spinner className="size-3" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
        {text}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolPart({
  name,
  state,
  part,
}: {
  name: string;
  state: string;
  part: UIMessage["parts"][number];
}) {
  const isLoading =
    state === "input-streaming" || state === "input-available";
  const hasOutput = state === "output-available";
  const hasError = state === "output-error";

  const outputValue =
    hasOutput && "output" in part ? part.output : undefined;
  const errorText =
    hasError && "errorText" in part ? (part.errorText as string) : undefined;

  return (
    <div className="my-1.5 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {isLoading ? (
          <Spinner className="size-3" />
        ) : hasError ? (
          <AlertCircle className="size-3 text-destructive" />
        ) : (
          <Wrench className="size-3" />
        )}
        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
          {name}
        </Badge>
        {isLoading && <span className="italic">running...</span>}
      </div>

      {hasOutput && outputValue != null && (
        <ToolOutput value={outputValue} />
      )}

      {hasError && errorText && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          {errorText}
        </div>
      )}
    </div>
  );
}

function ToolOutput({ value }: { value: unknown }) {
  const formatted =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);

  return (
    <pre className="overflow-x-auto rounded-md border bg-muted/50 px-2.5 py-1.5 text-xs font-mono text-muted-foreground">
      {formatted}
    </pre>
  );
}

function FilePart({ url, mediaType }: { url: string; mediaType: string }) {
  if (mediaType.startsWith("image/")) {
    return (
      <img
        src={url}
        alt="Attached file"
        className="my-1.5 max-h-64 rounded-md border"
      />
    );
  }

  return (
    <Badge variant="outline" className="my-1 text-xs">
      File: {mediaType}
    </Badge>
  );
}

function SourceUrlPart({ url, title }: { url: string; title?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="my-0.5 inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
    >
      {title ?? url}
    </a>
  );
}

export { ChatMessage };
export type { ChatMessageProps };
