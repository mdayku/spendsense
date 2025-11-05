"use client";
import React from "react";

type Item = { id: string; reason: string; createdAt: string; User: { name: string; email: string; id: string }; Profile: { persona: string; windowDays: number; decisionTrace: string } };

export default function Operator() {
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/operator/review", { cache: "no-store" });
    const data = await res.json();
    setItems(data.queue || []);
    setLoading(false);
  };
  React.useEffect(()=>{ load(); },[]);

  const decide = async (id: string, action: "approve" | "override") => {
    await fetch("/api/operator/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
    await load();
  };

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Operator Review Queue</h1>
          <p className="text-slate-600 mt-1">Approve or override items that require human oversight</p>
        </div>
        <button 
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" 
          onClick={load} 
          disabled={loading}
        >
          {loading ? "⟳ Loading..." : "↻ Refresh"}
        </button>
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <div className="text-6xl mb-4">✓</div>
          <div className="text-xl font-semibold text-slate-700">Queue is Empty</div>
          <div className="text-slate-500 mt-1">All review items have been processed</div>
        </div>
      )}

      <div className="space-y-4">
        {items.map(it => (
          <ReviewItem key={it.id} item={it} onDecide={decide} />
        ))}
      </div>
    </main>
  );
}

function ReviewItem({ item, onDecide }: { item: Item; onDecide: (id: string, action: "approve" | "override") => void }) {
  const [expanded, setExpanded] = React.useState(false);
  
  let trace: any = {};
  try {
    trace = JSON.parse(item.Profile.decisionTrace);
  } catch {
    trace = { error: "Could not parse decision trace", raw: item.Profile.decisionTrace };
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-bold text-slate-900">{item.User.name}</h3>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                {item.Profile.windowDays}d window
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded uppercase">
                {item.Profile.persona}
              </span>
            </div>
            <div className="text-sm text-slate-600">{item.User.email}</div>
            <div className="text-xs text-slate-500 mt-1">{new Date(item.createdAt).toLocaleString()}</div>
          </div>
          <a 
            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 underline" 
            href={`/profiles/${item.User.id}`} 
            target="_blank"
          >
            View Full Profile →
          </a>
        </div>
      </div>

      {/* Reason */}
      <div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
        <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-1">Review Reason</div>
        <div className="text-sm text-amber-800">{item.reason}</div>
      </div>

      {/* Decision Trace */}
      <div className="px-6 py-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-left hover:bg-slate-50 -mx-2 px-2 py-2 rounded transition-colors"
        >
          <span className="text-sm font-semibold text-slate-700">
            {expanded ? "▼" : "▶"} Decision Trace & Signals
          </span>
          <span className="text-xs text-slate-500">{expanded ? "Click to collapse" : "Click to expand"}</span>
        </button>
        
        {expanded && (
          <div className="mt-4 space-y-4">
            <DecisionTraceView trace={trace} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-3">
        <button 
          className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
          onClick={() => onDecide(item.id, "approve")}
        >
          ✓ Approve
        </button>
        <button 
          className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors"
          onClick={() => onDecide(item.id, "override")}
        >
          ✕ Override
        </button>
      </div>
    </div>
  );
}

function DecisionTraceView({ trace }: { trace: any }) {
  if (trace.error) {
    return <pre className="text-xs bg-slate-100 p-4 rounded overflow-auto">{trace.raw}</pre>;
  }

  // Handle old format where persona was an object {key, reason, priority}
  const personaKey = typeof trace.persona === 'string' ? trace.persona : trace.persona?.key;
  const personaReason = trace.personaReason || trace.persona?.reason;
  
  // Handle old format where signals might be nested under 's'
  const signals = trace.signals || trace.s;

  return (
    <div className="space-y-4">
      {/* Signals */}
      {signals && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-3">Behavioral Signals</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <SignalBadge label="Subscription Count" value={signals.subscriptionCount} />
            <SignalBadge label="Monthly Recurring" value={signals.monthlyRecurring != null ? `$${signals.monthlyRecurring.toFixed(0)}` : "N/A"} />
            <SignalBadge label="Sub Share" value={signals.subscriptionShare != null ? `${(signals.subscriptionShare * 100).toFixed(1)}%` : "N/A"} />
            <SignalBadge label="Savings Inflow" value={signals.netSavingsInflow != null ? `$${signals.netSavingsInflow.toFixed(0)}/mo` : "N/A"} />
            <SignalBadge label="Savings Growth" value={signals.savingsGrowthRate != null ? `${(signals.savingsGrowthRate * 100).toFixed(1)}%` : "N/A"} />
            <SignalBadge label="Emergency Fund" value={signals.emergencyMonths != null ? `${signals.emergencyMonths.toFixed(2)} mo` : "N/A"} />
            <SignalBadge label="Max Utilization" value={signals.utilMax != null ? `${(signals.utilMax * 100).toFixed(0)}%` : "N/A"} />
            <SignalBadge label="Util Flags" value={signals.utilFlags || "none"} />
            <SignalBadge label="Income Gap" value={signals.incomeMedianGap != null ? `${signals.incomeMedianGap} days` : "N/A"} />
            <SignalBadge label="Cash Buffer" value={signals.cashBufferMonths != null ? `${signals.cashBufferMonths.toFixed(2)} mo` : "N/A"} />
          </div>
        </div>
      )}

      {/* Persona Assignment */}
      {personaKey && (
        <div className="bg-purple-50 rounded-lg p-4">
          <h4 className="font-semibold text-purple-900 mb-2">Persona Assignment</h4>
          <div className="text-2xl font-bold text-purple-700 uppercase mb-2">{personaKey}</div>
          {personaReason && (
            <div className="text-sm text-purple-800 bg-white rounded p-2">{personaReason}</div>
          )}
        </div>
      )}

      {/* Full JSON (collapsible) */}
      <details className="bg-slate-100 rounded-lg">
        <summary className="px-4 py-2 cursor-pointer text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg">
          View Raw JSON
        </summary>
        <pre className="text-xs p-4 overflow-auto max-h-96 border-t border-slate-200">
          {JSON.stringify(trace, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function SignalBadge({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white rounded p-2 border border-blue-200">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="font-semibold text-slate-900">{value ?? "N/A"}</div>
    </div>
  );
}

