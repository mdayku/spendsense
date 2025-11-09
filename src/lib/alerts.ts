import dayjs from "dayjs";
import { Transaction } from "@prisma/client";

/**
 * Educational-only heuristics. These are NOT law-enforcement determinations or legal advice.
 * They highlight patterns that *could* resemble known AML typologies. Show with a disclaimer.
 */
export function amlEducationalAlerts(tx: Transaction[], windowDays: number) {
  const alerts: string[] = [];
  const since = dayjs().subtract(windowDays, "day");
  const recent = tx.filter(t => dayjs(t.date).isAfter(since));

  // Many transfers to few counterparties
  // Exclude legitimate transfers like "Savings Transfer" - only flag suspicious patterns
  const transfers = recent.filter(t => 
    t.pfcPrimary === "transfer" && 
    t.amount < 0 &&
    t.merchant !== "Savings Transfer" && // Exclude legitimate savings transfers
    !t.merchant?.toLowerCase().includes("savings") // Exclude any savings-related transfers
  );
  const byCounterparty: Record<string, number> = {};
  for (const t of transfers) {
    const k = t.merchantEntityId || t.merchant || "unknown";
    // Skip generic/unknown counterparties - only flag specific entities
    if (k !== "unknown" && !k.toLowerCase().includes("transfer")) {
      byCounterparty[k] = (byCounterparty[k] || 0) + 1;
    }
  }
  const top = Object.entries(byCounterparty).sort((a,b)=>b[1]-a[1])[0];
  if (top && top[1] >= 10) alerts.push(`High volume of transfers (${top[1]}) to a single counterparty in ${windowDays}d.`);

  // Rapid in/out (smurfing-like), same-day inflow then outflow
  const inflowsByDay = new Map<string, number>();
  const outflowsByDay = new Map<string, number>();
  for (const t of recent) {
    const d = dayjs(t.date).format("YYYY-MM-DD");
    if (t.amount > 0) inflowsByDay.set(d, (inflowsByDay.get(d)||0) + t.amount);
    if (t.amount < 0) outflowsByDay.set(d, (outflowsByDay.get(d)||0) + Math.abs(t.amount));
  }
  let sameDayCount = 0;
  inflowsByDay.forEach((v,d)=>{ if ((outflowsByDay.get(d)||0) > 0) sameDayCount++; });
  if (sameDayCount >= 8) alerts.push(`${sameDayCount} days with same‑day in/out flows.`);

  return alerts;
}

export const AML_EDU_DISCLOSURE = "Potential AML‑like pattern detected. This is not a determination of wrongdoing, nor legal or financial advice.";

