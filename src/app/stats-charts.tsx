"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StatsData } from "@/lib/stats/queries";

const AMBER = "#d97706";
const GREEN = "#15803d";
const GRID = "#efeeeb";
const AXIS = "#6f6b63";

const money = new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 0 });

function fmt(value: number) {
  return `${money.format(Math.round(value))} lei`;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
      <div className="border-b border-[#e8e7e3] px-4 py-3">
        <h2 className="font-semibold text-[#1b1a17]">{title}</h2>
      </div>
      <div className="px-2 py-3 sm:px-3">{children}</div>
    </div>
  );
}

// ponytail: default recharts tooltip is enough; light restyle only.
const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #e8e7e3",
  fontSize: 12,
} as const;

/** Venit (bare) + Profit (linie) pe zile — cronologic vechi→nou. */
export function DailyChart({
  rows,
  canModify,
}: {
  rows: StatsData["daily"];
  canModify: boolean;
}) {
  const data = [...rows]
    .reverse()
    .map((row) => ({
      name: row.label.slice(0, 5), // "18.06"
      Venit: Math.round(row.revenueLei),
      Profit: Math.round(row.profitLei),
    }));

  return (
    <ChartCard title="Venit pe zile (ultimele 14 cu vânzări)">
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis
            tick={{ fontSize: 11, fill: AXIS }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => money.format(v)}
          />
          <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={tooltipStyle} />
          <Bar dataKey="Venit" fill={AMBER} radius={[4, 4, 0, 0]} maxBarSize={34} />
          {canModify ? (
            <Line
              dataKey="Profit"
              type="monotone"
              stroke={GREEN}
              strokeWidth={2}
              dot={{ r: 2.5 }}
              activeDot={{ r: 4 }}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Venit (bare) + Profit (linie) pe luni — trend anual. */
export function MonthlyChart({
  rows,
  canModify,
}: {
  rows: StatsData["monthly"];
  canModify: boolean;
}) {
  if (rows.length === 0) return null;

  const data = [...rows].reverse().map((row) => ({
    name: row.label,
    Venit: Math.round(row.revenueLei),
    Profit: Math.round(row.profitLei),
  }));

  return (
    <ChartCard title="Venit pe luni (ultimele 12)">
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis
            tick={{ fontSize: 11, fill: AXIS }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => money.format(v)}
          />
          <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={tooltipStyle} />
          <Bar dataKey="Venit" fill="#f0b054" radius={[4, 4, 0, 0]} maxBarSize={40} />
          {canModify ? (
            <Line
              dataKey="Profit"
              type="monotone"
              stroke={GREEN}
              strokeWidth={2}
              dot={{ r: 2.5 }}
              activeDot={{ r: 4 }}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Top produse — bare orizontale după cantitate. */
export function TopProductsChart({ rows }: { rows: StatsData["topProducts"] }) {
  if (rows.length === 0) return null;

  const data = rows.map((p) => ({
    name: p.label.length > 22 ? `${p.label.slice(0, 22)}…` : p.label,
    Cantitate: p.quantity,
  }));

  return (
    <ChartCard title="Top produse vândute (30 zile)">
      <ResponsiveContainer width="100%" height={Math.max(data.length * 34, 120)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: AXIS }}
            tickLine={false}
            axisLine={false}
            width={150}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v)} buc.`} />
          <Bar dataKey="Cantitate" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? AMBER : "#f0b054"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
