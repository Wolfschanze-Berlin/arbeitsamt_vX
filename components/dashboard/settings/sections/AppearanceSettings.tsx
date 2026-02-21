"use client";

import { useSettings } from "@/context/settings-context";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Theme } from "@/lib/settings";

const themeOptions: { value: Theme; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "Light background with dark text" },
  { value: "dark", label: "Dark", description: "Dark background with light text" },
  { value: "system", label: "System", description: "Follow operating system preference" },
];

export function AppearanceSettings() {
  const { settings, updateTheme } = useSettings();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-base font-medium">Theme</Label>
        <RadioGroup
          value={settings.theme}
          onValueChange={(v) => updateTheme(v as Theme)}
          className="grid gap-3"
        >
          {themeOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-muted"
            >
              <RadioGroupItem value={option.value} />
              <div>
                <p className="text-sm font-medium">{option.label}</p>
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}
