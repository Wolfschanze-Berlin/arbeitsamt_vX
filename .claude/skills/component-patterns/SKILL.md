---
name: Component Patterns
description: >
  React component patterns for arbeitsamt_vX using shadcn/ui, Radix, and Tailwind 4.
  Use this skill whenever creating components, pages, forms, charts, widgets, dialogs,
  tables, or any UI feature. Also use when the user says "add a button", "build a form",
  "make a chart", "create a page", "add a modal", "dashboard widget", "loading state",
  or asks about component structure, imports, or UI patterns in this project.
version: 1.1.0
---

# Component Patterns - arbeitsamt_vX

## Quick Reference

| Pattern | Location | Key Imports |
|---------|----------|-------------|
| Page | `app/(dashboard)/my-page/page.tsx` | — |
| Dashboard widget | `components/dashboard/my-widget.tsx` | Card from `@/components/ui/card` |
| Form | `components/dashboard/*/` | react-hook-form, zod, Form from `@/components/ui/form` |
| Chart | `components/dashboard/*/` | ChartContainer, recharts |
| Context provider | `context/my-context.tsx` | createContext, useContext, useCallback, useMemo |
| Custom hook | `hooks/useMyHook.ts` | SWR, `@/lib/tauri` |
| Dialog/Modal | `components/dashboard/*/` | Dialog from `@/components/ui/dialog` |

## shadcn/ui Usage

Add new components via CLI — never edit `components/ui/` manually:
```bash
bunx shadcn add [component-name]
```

Installed components (40+): accordion, alert, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, dialog, drawer, dropdown-menu, form, input, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip.

## Page Pattern (App Router)

Every page lives under the `(dashboard)` route group and needs `"use client"`:
```tsx
// app/(dashboard)/my-page/page.tsx
"use client"

import { SomeWidget } from "@/components/dashboard/some-widget"

export default function MyPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Page Title</h1>
      <SomeWidget />
    </div>
  )
}
```

## Dashboard Component Pattern

```tsx
// components/dashboard/my-widget.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface MyWidgetProps {
  title: string
  children: React.ReactNode
}

export function MyWidget({ title, children }: MyWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
```

## Form Pattern

Forms use react-hook-form + zod for validation — this is the standard pattern:
```tsx
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const schema = z.object({
  name: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
})

type FormValues = z.infer<typeof schema>

export function MyForm({ onSubmit }: { onSubmit: (data: FormValues) => void }) {
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
```

## Chart Pattern

Charts use shadcn's ChartContainer with Recharts. Always type the data:
```tsx
"use client"

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis } from "recharts"

interface ChartDataPoint {
  name: string
  value: number
}

const chartConfig = { value: { label: "Value", color: "var(--chart-1)" } }

export function MyChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <ChartContainer config={chartConfig}>
      <BarChart data={data}>
        <XAxis dataKey="name" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--chart-1)" />
      </BarChart>
    </ChartContainer>
  )
}
```

## Context Provider Pattern

The project uses React Context for shared state. Follow this structure:
```tsx
// context/my-context.tsx
"use client"

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react"

interface MyContextType {
  value: string
  setValue: (v: string) => void
}

const MyContext = createContext<MyContextType | undefined>(undefined)

export function MyProvider({ children }: { children: ReactNode }) {
  const [value, setValueState] = useState("")
  const setValue = useCallback((v: string) => setValueState(v), [])
  const contextValue = useMemo(() => ({ value, setValue }), [value, setValue])

  return <MyContext.Provider value={contextValue}>{children}</MyContext.Provider>
}

export function useMyContext() {
  const ctx = useContext(MyContext)
  if (!ctx) throw new Error("useMyContext must be used within MyProvider")
  return ctx
}
```

## Custom Hook Pattern (SWR + Tauri)

Data fetching hooks use SWR with the Tauri IPC bridge:
```tsx
// hooks/useMyData.ts
"use client"

import useSWR from "swr"
import { tauriInvoke } from "@/lib/tauri"

export function useMyData(id: string | null) {
  return useSWR<MyDataType>(
    id ? `my-data:${id}` : null,
    id ? () => tauriInvoke<MyDataType>("get_my_data", { id }) : null,
    { revalidateOnFocus: false, keepPreviousData: true },
  )
}
```

## Dialog/Modal Pattern

```tsx
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  title: string
  children: React.ReactNode
  onConfirm: () => void
}

export function ConfirmDialog({ title, children, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">{title}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {children}
        <Button onClick={onConfirm}>Confirm</Button>
      </DialogContent>
    </Dialog>
  )
}
```

## Layout Integration

- All dashboard pages use `app/(dashboard)/layout.tsx` which loads `DashboardShell` with `ssr: false`
- Sidebar: `components/layout/app-sidebar.tsx`
- Theme toggle available in layout header via `context/theme-context.tsx`
- Mobile-responsive via `hooks/use-mobile.ts`
- Navigation items defined in `components/layout/nav-main.tsx`

## Key Conventions

- Every component file needs `"use client"` — this is a Tauri app with static export, no server components
- Use `@/` import alias for all imports
- Use `cn()` from `@/lib/utils` for conditional Tailwind classes
- Use CSS variables for colors (e.g., `var(--chart-1)`) — never hardcode hex values
- All props must be typed with TypeScript interfaces — no `any`
- Wrap Tauri IPC calls through `@/lib/tauri` helpers, never import `@tauri-apps/api` directly

See also: **project-patterns** for architecture and directory conventions, **sdk-patterns** for automating component creation via agents.
