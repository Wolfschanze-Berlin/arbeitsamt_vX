"use client";

import { useMemo } from "react";

interface MetricsSparklineProps {
  data: number[];
  color: string;
  width: number;
  height: number;
}

interface BtopBarChartProps {
  data: number[];
  color: string;
  width: number;
  height: number;
  maxValue?: number;
}

function MetricsSparkline({ data, color, width, height }: MetricsSparklineProps) {
  const { pathD, areaD, gradientId } = useMemo(() => {
    const id = `sparkline-grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

    if (data.length < 2) {
      return { pathD: "", areaD: "", gradientId: id };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return { x, y };
    });

    const linePoints = points.map((p) => `${p.x},${p.y}`);
    const line = `M ${linePoints.join(" L ")}`;

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const area = `${line} L ${lastPoint.x},${height} L ${firstPoint.x},${height} Z`;

    return { pathD: line, areaD: area, gradientId: id };
  }, [data, color, width, height]);

  if (data.length < 2) {
    return (
      <svg width={width} height={height} className="overflow-visible">
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground text-[10px]"
        >
          waiting...
        </text>
      </svg>
    );
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BtopBarChart({ data, color, width, height, maxValue }: BtopBarChartProps) {
  const bars = useMemo(() => {
    if (data.length === 0) return [];
    const max = maxValue ?? Math.max(...data, 1);
    const barWidth = Math.max(1, width / data.length - 1);
    return data.map((v, i) => {
      const barHeight = (v / max) * height;
      return {
        x: i * (barWidth + 1),
        y: height - barHeight,
        w: barWidth,
        h: barHeight,
        value: v,
      };
    });
  }, [data, width, height, maxValue]);

  if (data.length === 0) {
    return (
      <svg width={width} height={height} className="overflow-visible">
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground text-[10px]"
        >
          ...
        </text>
      </svg>
    );
  }

  return (
    <svg width={width} height={height} className="overflow-hidden">
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={bar.y}
          width={bar.w}
          height={bar.h}
          fill={color}
          opacity={0.8}
          rx={0.5}
        />
      ))}
    </svg>
  );
}

export { MetricsSparkline, BtopBarChart };
export type { MetricsSparklineProps, BtopBarChartProps };
