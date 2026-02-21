---
name: Component Patterns
description: This skill provides guidance on React component patterns for arbeitsamt_vX using shadcn/ui, Radix, and Tailwind. Use when creating new components, pages, or UI features.
version: 1.0.0
---

# Component Patterns - arbeitsamt_vX

## shadcn/ui Usage

Add new components via CLI:
```bash
bunx shadcn add [component-name]
```

Available components (40+ installed): accordion, alert, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, dialog, drawer, dropdown-menu, form, input, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip.

## Page Pattern (App Router)

```tsx
// app/(dashboard)/my-page/page.tsx
export default function MyPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Page Title</h1>
      {/* Page content */}
    </div>
  )
}
```

## Dashboard Component Pattern

```tsx
// components/dashboard/my-widget.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function MyWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Widget Title</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Widget content */}
      </CardContent>
    </Card>
  )
}
```

## Form Pattern

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
})

export function MyForm() {
  const form = useForm({ resolver: zodResolver(schema) })
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
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

```tsx
"use client"

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis } from "recharts"

const chartConfig = { value: { label: "Value", color: "var(--chart-1)" } }

export function MyChart({ data }) {
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

## Layout Integration

- All dashboard pages use `app/(dashboard)/layout.tsx`
- Sidebar via `components/layout/app-sidebar.tsx`
- Theme toggle available in layout header
- Mobile-responsive via `hooks/use-mobile.ts`
