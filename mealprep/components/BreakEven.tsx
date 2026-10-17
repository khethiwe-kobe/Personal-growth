"use client";
import { useState } from "react";
import { breakEven, formatZar } from "@/lib/costing";
import { LineChart } from "@/components/charts";

export default function BreakEven({ fixed, price, variable }: { fixed: number; price: number; variable: number }) {
  const [f, setF] = useState(fixed), [p, setP] = useState(price), [v, setV] = useState(variable), [mpc, setMpc] = useState(20);
  const r = breakEven(f, p, v, mpc);
  const xs = [0, 100, 200, 300, 400, 500, 600, 800, 1000, 1200, 1500].filter((x) => Number.isFinite(r.meals) ? x <= Math.max(1500, r.meals * 1.5) : true);
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="grid grid-cols-2 gap-3">
        <label className="block col-span-2"><span className="label">Monthly fixed costs (R)</span><input type="number" value={f} onChange={(e) => setF(Number(e.target.value))} className="input" /></label>
        <label className="block"><span className="label">Average selling price (R)</span><input type="number" value={p} onChange={(e) => setP(Number(e.target.value))} className="input" /></label>
        <label className="block"><span className="label">Variable cost per meal (R)</span><input type="number" value={v} onChange={(e) => setV(Number(e.target.value))} className="input" /></label>
        <label className="block col-span-2"><span className="label">Meals per client per month</span><input type="number" value={mpc} onChange={(e) => setMpc(Number(e.target.value))} className="input" /></label>
        <div className="col-span-2 text-xs text-ink-2">Example: fixed R20,000, price R100, variable R50 → contribution R50 → 400 meals/month.</div>
      </div>
      <div>
        <table className="table"><tbody>
          <tr><td>Contribution per meal</td><td className="text-right font-medium">{formatZar(r.contribution)} ({r.contribution_margin_pct.toFixed(0)}%)</td></tr>
          <tr><td>Break-even meals / month</td><td className="text-right font-medium">{Number.isFinite(r.meals) ? r.meals : "∞ (price ≤ cost)"}</td></tr>
          <tr><td>Break-even meals / week</td><td className="text-right">{Number.isFinite(r.meals) ? Math.ceil(r.meals / 4.33) : "—"}</td></tr>
          <tr><td>Break-even clients / month</td><td className="text-right font-medium">{Number.isFinite(r.clients) ? r.clients : "—"}</td></tr>
          <tr><td>Break-even revenue</td><td className="text-right font-medium">{Number.isFinite(r.revenue) ? formatZar(r.revenue) : "—"}</td></tr>
        </tbody></table>
        <div className="mt-4"><LineChart labels={xs.map(String)} series={[{ name: "Revenue", values: xs.map((x) => x * p) }, { name: "Total cost", values: xs.map((x) => f + x * v) }]} unit="R" height={180} /></div>
        <div className="text-[11px] text-ink-3 mt-1">x-axis: meals per month. Lines cross at break-even.</div>
      </div>
    </div>
  );
}
