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
  // Normal behavior: getting paid and spending on same day occasionally
  // Suspicious: frequent large in/out flows suggesting money laundering passthrough
  const inflowsByDay = new Map<string, number>();
  const outflowsByDay = new Map<string, number>();
  for (const t of recent) {
    const d = dayjs(t.date).format("YYYY-MM-DD");
    // Only count substantial amounts (not small purchases on payday)
    if (t.amount > 0 && t.amount > 500) inflowsByDay.set(d, (inflowsByDay.get(d)||0) + t.amount);
    if (t.amount < 0 && Math.abs(t.amount) > 500) outflowsByDay.set(d, (outflowsByDay.get(d)||0) + Math.abs(t.amount));
  }
  let sameDayCount = 0;
  let suspiciousDays = 0;
  inflowsByDay.forEach((inflow, d) => {
    const outflow = outflowsByDay.get(d) || 0;
    if (outflow > 0) {
      sameDayCount++;
      // Extra suspicious if amounts are similar (within 20% - suggests passthrough)
      if (Math.abs(inflow - outflow) / inflow < 0.2) {
        suspiciousDays++;
      }
    }
  });
  
  // Adjust threshold based on window size
  // 30-day: need 10+ days (33% of window) with significant in/out
  // 180-day: need 25+ days (14% of window) with significant in/out
  const threshold = windowDays === 30 ? 10 : 25;
  if (sameDayCount >= threshold) {
    alerts.push(`${sameDayCount} days with same‑day in/out flows of substantial amounts.`);
  }

  return alerts;
}

export const AML_EDU_DISCLOSURE = "Potential AML‑like pattern detected. This is not a determination of wrongdoing, nor legal or financial advice.";

