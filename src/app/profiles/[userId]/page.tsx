"use client";
import React from "react";

export default function ProfileView({ params }: { params: { userId: string } }) {
  const { userId } = params;
  const [profileData, setProfileData] = React.useState<any>(null);
  const [recs, setRecs] = React.useState<any>(null);
  const [alerts, setAlerts] = React.useState<{alerts30:string[];alerts180:string[]}>({alerts30:[],alerts180:[]});
  const [labels, setLabels] = React.useState<number>(0);

  React.useEffect(() => {
    (async () => {
      const p = await fetch(`/api/profile/${userId}`).then(r=>r.json());
      const r = await fetch(`/api/recommendations/${userId}`).then(r=>r.json());
      const a = await fetch(`/api/alerts/${userId}`).then(r=>r.json());
      const l = await fetch(`/api/aml/labels/${userId}`).then(r=>r.json());
      setProfileData(p); setRecs(r); setAlerts(a); setLabels(l.count || 0);
    })();
  }, [userId]);

  if (!profileData) return <main className="p-6">Loading…</main>;
  const p30 = profileData.profiles?.find((p:any)=>p.windowDays===30);
  const p180 = profileData.profiles?.find((p:any)=>p.windowDays===180);

  const Banner = ({children}:{children:React.ReactNode}) => (
    <div className="p-3 rounded-lg border bg-amber-50 border-amber-200 text-amber-900 text-sm">{children}</div>
  );

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {(alerts.alerts30.length>0 || alerts.alerts180.length>0) && (
        <Banner>
          <b>Educational AML alert:</b> potential AML-like patterns detected (30d: {alerts.alerts30.length}, 180d: {alerts.alerts180.length}). This is not a determination of wrongdoing, nor legal or financial advice.
        </Banner>
      )}

      {labels>0 && (
        <Banner>
          <b>Dataset label notice:</b> {labels} AML-labelled transactions exist for this user (from Kaggle source). Used for comparison only.
        </Banner>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded-xl shadow">
          <h2 className="font-semibold mb-2">30d</h2>
          {p30 ? <ProfileCard p={p30} /> : <div className="text-slate-500">No 30d profile yet</div>}
        </div>
        <div className="p-4 bg-white rounded-xl shadow">
          <h2 className="font-semibold mb-2">180d</h2>
          {p180 ? <ProfileCard p={p180} /> : <div className="text-slate-500">No 180d profile yet</div>}
        </div>
      </section>

      <section className="p-4 bg-white rounded-xl shadow">
        <h2 className="font-semibold mb-2">Recommendations</h2>
        <ul className="list-disc ml-6">
          {(recs?.items||[]).map((i:any)=> (
            <li key={i.id} className="mb-1"><b>{i.title}</b><div className="text-sm text-slate-600">{i.rationale}</div></li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function ProfileCard({ p }: { p:any }){
  const rows = [
    ["Persona", p.persona],
    ["Subscriptions", `${p.subscriptionCount} / $${p.monthlyRecurring.toFixed(0)} / ${(p.subscriptionShare*100).toFixed(1)}%`],
    ["Savings", `inflow $${p.netSavingsInflow.toFixed(0)}/mo • growth ${(p.savingsGrowthRate*100).toFixed(1)}% • emergency ${p.emergencyMonths.toFixed(2)} mo`],
    ["Credit", `utilMax ${(p.utilMax*100).toFixed(0)}% • flags ${p.utilFlags}`],
    ["Income", `median gap ${p.incomeMedianGap}d • buffer ${p.cashBufferMonths.toFixed(2)} mo`],
  ];
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([k,v])=> (
          <tr key={k as string}><td className="py-1 pr-3 text-slate-500">{k}</td><td className="py-1">{v as string}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

