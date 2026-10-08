"use client";
import { useState } from "react";
import { priceForMargin, formatZar } from "@/lib/costing";

const F = ({ label, v, set, step = 1 }: { label: string; v: number; set: (n: number) => void; step?: number }) => <label className="block"><span className="label">{label}</span><input type="number" step={step} value={v} onChange={(e) => set(Number(e.target.value))} className="input" /></label>;

export default function PricingCalculator({ defaults }: { defaults: { packaging: number; labourRate: number; overhead: number; margins: { conservative: number; standard: number; premium: number } } }) {
  const [ingredients, setIngredients] = useState(28);
  const [packaging, setPackaging] = useState(defaults.packaging);
  const [labourMin, setLabourMin] = useState(4);
  const [overhead, setOverhead] = useState(defaults.overhead);
  const [delivery, setDelivery] = useState(0);
  const [margin, setMargin] = useState(defaults.margins.standard);
  const labour = (labourMin / 60) * defaults.labourRate;
  const cost = ingredients + packaging + labour + overhead + delivery;
  const price = priceForMargin(cost, margin);
  const rows = [["Conservative", defaults.margins.conservative], ["Standard", defaults.margins.standard], ["Premium", defaults.margins.premium], ["Custom", margin]] as const;
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="grid grid-cols-2 gap-2">
        <F label="Ingredient cost (R)" v={ingredients} set={setIngredients} step={0.5} />
        <F label="Packaging (R)" v={packaging} set={setPackaging} step={0.1} />
        <F label="Labour (minutes)" v={labourMin} set={setLabourMin} step={0.5} />
        <F label="Overhead (R)" v={overhead} set={setOverhead} step={0.5} />
        <F label="Delivery share (R)" v={delivery} set={setDelivery} step={1} />
        <label className="block"><span className="label">Desired margin ({Math.round(margin * 100)}%)</span><input type="range" min={0.2} max={0.8} step={0.01} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full" /></label>
      </div>
      <div>
        <div className="text-sm text-ink-2">True cost</div><div className="stat-value">{formatZar(cost)}</div>
        <div className="text-xs text-ink-3">ingredients {formatZar(ingredients)} · packaging {formatZar(packaging)} · labour {formatZar(labour)} · overhead {formatZar(overhead)} · delivery {formatZar(delivery)}</div>
        <table className="table mt-3"><thead><tr><th>Scenario</th><th>Margin</th><th>Price</th><th>Profit</th></tr></thead><tbody>{rows.map(([n, m]) => { const p = priceForMargin(cost, m); return <tr key={n} className={n === "Custom" ? "font-medium" : ""}><td>{n}</td><td>{Math.round(m * 100)}%</td><td>{formatZar(p)}</td><td>{formatZar(p - cost)}</td></tr>; })}</tbody></table>
        <div className="text-xs text-ink-2 mt-2">Recommended selling price at {Math.round(margin * 100)}% margin: <b className="text-ink">{formatZar(price)}</b> (gross profit {formatZar(price - cost)}).</div>
      </div>
    </div>
  );
}
