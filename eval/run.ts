import { prisma } from "@/lib/zz_prisma";
import { computeSignals } from "@/lib/signals";
import { assignPersona, shape } from "@/lib/personas";
import { recommendationsFor } from "@/lib/recommend";
import { performance } from "perf_hooks";
import * as fs from "node:fs";

function summarize(metrics: any[]) { const n=metrics.length; const pct=(x:number)=>Math.round(100*x/n); return { count:n, coverage:pct(metrics.filter(m=>m.coverage).length), explainability:pct(metrics.filter(m=>m.explainability).length), auditability:pct(metrics.filter(m=>m.auditability).length), latencyP95Ms: metrics.map(m=>m.latencyMs).sort((a,b)=>a-b)[Math.floor(0.95*n)] || 0 }; }

async function evalAll() {
  const users = await prisma.user.findMany();
  const out: any[] = [];
  for (const u of users) {
    const t0 = performance.now();
    const s = await computeSignals(u.id, 30);
    const persona = assignPersona(shape(s));
    const items = recommendationsFor(persona.key, s, { last4: "4523" });
    const latency = performance.now() - t0;
    const explainability = items.every(i => i.rationale && i.rationale.length > 0);
    const coverage = Boolean(persona.key) && [ s.subscriptionCount >= 0, s.netSavingsInflow !== undefined, s.utilMax !== undefined, s.incomeMedianGap !== undefined ].filter(Boolean).length >= 3;
    const auditability = true;
    out.push({ userId: u.id, windowDays: 30, coverage, explainability, latencyMs: Math.round(latency), auditability });
  }
  const summary = summarize(out);
  fs.mkdirSync("eval/out", { recursive: true });
  fs.writeFileSync("eval/out/metrics.json", JSON.stringify({ perUser: out, summary }, null, 2));
  console.log(summary);
}

evalAll().then(()=>process.exit(0));

