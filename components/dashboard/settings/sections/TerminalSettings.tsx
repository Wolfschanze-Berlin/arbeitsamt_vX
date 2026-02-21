"use client";

import { useSettings } from "@/context/settings-context";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type CursorStyle,
  type ColorPreset,
  type TerminalSettings as TerminalSettingsType,
  COLOR_PRESETS,
} from "@/lib/settings";

const cursorOptions: { value: CursorStyle; label: string }[] = [
  { value: "block", label: "Block" },
  { value: "bar", label: "Bar" },
  { value: "underline", label: "Underline" },
];

const colorPresetOptions: { value: ColorPreset; label: string }[] = [
  { value: "default", label: "Default (Dark)" },
  { value: "dracula", label: "Dracula" },
  { value: "solarized-dark", label: "Solarized Dark" },
];

export function TerminalSettings() {
  const { settings, updateTerminal } = useSettings();
  const term = settings.terminal;

  function update(partial: Partial<TerminalSettingsType>) {
    updateTerminal({ ...term, ...partial });
  }

  const presetColors = COLOR_PRESETS[term.colorPreset];

  return (
    <div className="space-y-6">
      {/* Font Size */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Font Size</Label>
        <div className="flex items-center gap-4">
          <Slider
            min={10}
            max={24}
            step={1}
            value={[term.fontSize]}
            onValueChange={([v]) => update({ fontSize: v })}
            className="flex-1"
          />
          <Input
            type="number"
            min={10}
            max={24}
            value={term.fontSize}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (v >= 10 && v <= 24) update({ fontSize: v });
            }}
            className="w-16"
          />
        </div>
      </div>

      {/* Cursor Style */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Cursor Style</Label>
        <RadioGroup
          value={term.cursorStyle}
          onValueChange={(v) => update({ cursorStyle: v as CursorStyle })}
          className="flex gap-4"
        >
          {cursorOptions.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2">
              <RadioGroupItem value={opt.value} />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Cursor Blink */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Cursor Blink</Label>
          <p className="text-xs text-muted-foreground">Animate the terminal cursor</p>
        </div>
        <Switch
          checked={term.cursorBlink}
          onCheckedChange={(v) => update({ cursorBlink: v })}
        />
      </div>

      {/* Scrollback */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Scrollback Lines</Label>
        <Input
          type="number"
          min={100}
          max={10000}
          step={100}
          value={term.scrollback}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (v >= 100 && v <= 10000) update({ scrollback: v });
          }}
          className="w-32"
        />
        <p className="text-xs text-muted-foreground">
          Number of lines kept in terminal history (100–10,000)
        </p>
      </div>

      {/* Color Scheme */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Color Scheme</Label>
        <Select
          value={term.colorPreset}
          onValueChange={(v) => update({ colorPreset: v as ColorPreset })}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {colorPresetOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Live Preview */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Preview</Label>
        <div
          className="rounded-lg border p-4 font-mono"
          style={{
            backgroundColor: presetColors.background,
            color: presetColors.foreground,
            fontSize: `${term.fontSize}px`,
            lineHeight: 1.4,
          }}
        >
          <span style={{ color: presetColors.green }}>user@host</span>
          <span style={{ color: presetColors.foreground }}>:</span>
          <span style={{ color: presetColors.blue }}>~/projects</span>
          <span style={{ color: presetColors.foreground }}>$ </span>
          <span>The quick brown fox jumps over the lazy dog</span>
          <span
            style={{
              display: "inline-block",
              width: term.cursorStyle === "bar" ? "2px" : "0.6em",
              height: term.cursorStyle === "underline" ? "2px" : "1.2em",
              backgroundColor: presetColors.cursor,
              verticalAlign: term.cursorStyle === "underline" ? "bottom" : "middle",
              animation: term.cursorBlink ? "blink 1s step-end infinite" : "none",
              marginLeft: "1px",
            }}
          />
        </div>
      </div>
    </div>
  );
}
