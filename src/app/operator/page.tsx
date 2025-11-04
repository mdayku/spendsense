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
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Operator Review</h1>
      <p className="text-slate-600">Approve/override items. Items may include persona changes or AML educational alerts.</p>
      <button className="px-3 py-2 rounded bg-black text-white" onClick={load} disabled={loading}>{loading?"Loading...":"Refresh"}</button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(it => (
          <div key={it.id} className="p-4 bg-white rounded-xl shadow space-y-2">
            <div className="text-sm text-slate-500">{new Date(it.createdAt).toLocaleString()}</div>
            <div className="font-semibold">{it.User.name} <span className="text-slate-500">({it.User.email})</span></div>
            <div className="text-sm">Persona: <b className="uppercase">{it.Profile.persona}</b> • Window: {it.Profile.windowDays}d</div>
            <div className="text-xs bg-slate-50 p-2 rounded">Reason: {it.reason}</div>
            <pre className="text-xs overflow-auto max-h-40 bg-slate-50 p-2 rounded">{it.Profile.decisionTrace}</pre>
            <div className="flex gap-2">
              <button className="px-3 py-2 rounded bg-emerald-600 text-white" onClick={()=>decide(it.id, "approve")}>Approve</button>
              <button className="px-3 py-2 rounded bg-amber-600 text-white" onClick={()=>decide(it.id, "override")}>Override</button>
              <a className="underline ml-auto" href={`/api/profile/${it.User.id}`} target="_blank">Profile JSON</a>
            </div>
          </div>
        ))}
      </div>
      {items.length===0 && <div className="text-slate-500">Queue is empty.</div>}
    </main>
  );
}

