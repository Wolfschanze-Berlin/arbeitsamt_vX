"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/theme-context";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { toggleTheme } = useTheme();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className="size-10 rounded-full"
    >
      <Sun className="size-5 dark:hidden" />
      <Moon className="hidden size-5 dark:block" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
