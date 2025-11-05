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

  if (!profileData) return (
    <main className="max-w-7xl mx-auto p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="h-64 bg-slate-200 rounded"></div>
      </div>
    </main>
  );

  const p30 = profileData.profiles?.find((p:any)=>p.windowDays===30);
  const p180 = profileData.profiles?.find((p:any)=>p.windowDays===180);

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Profile</h1>
          <p className="text-slate-600 mt-1">{profileData.user?.name} • {profileData.user?.email}</p>
        </div>
        <a href="/users" className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 underline">
          ← Back to Users
        </a>
      </div>

      {/* Alerts */}
      {(alerts.alerts30.length>0 || alerts.alerts180.length>0) && (
        <div className="p-4 rounded-lg border-2 border-amber-400 bg-amber-50">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div className="flex-1">
              <div className="font-bold text-amber-900 mb-1">Educational AML Alert</div>
              <div className="text-sm text-amber-800">
                Potential AML-like patterns detected in transaction history:
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  <li><b>30-day window:</b> {alerts.alerts30.length} alert{alerts.alerts30.length !== 1 ? 's' : ''}</li>
                  <li><b>180-day window:</b> {alerts.alerts180.length} alert{alerts.alerts180.length !== 1 ? 's' : ''}</li>
                </ul>
                <div className="mt-2 text-xs italic">This is not a determination of wrongdoing, nor legal or financial advice.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {labels>0 && (
        <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 text-sm">
          <span className="font-semibold text-blue-900">📊 Dataset Notice:</span>{" "}
          <span className="text-blue-800">{labels} AML-labelled transactions exist for this user (from Kaggle source). Used for comparison only.</span>
        </div>
      )}

      {/* Persona Windows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfileCard title="30-Day Profile" profile={p30} color="blue" />
        <ProfileCard title="180-Day Profile" profile={p180} color="purple" />
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 px-6 py-4 border-b border-emerald-200">
          <h2 className="text-xl font-bold text-emerald-900">💡 Personalized Recommendations</h2>
          <p className="text-sm text-emerald-700 mt-1">Educational content tailored to your financial profile</p>
        </div>
        <div className="p-6">
          {(!recs?.items || recs.items.length === 0) ? (
            <div className="text-center py-8 text-slate-500">
              <div className="text-4xl mb-2">📭</div>
              <div>No recommendations available</div>
            </div>
          ) : (
            <div className="space-y-4">
              {recs.items.map((item:any, idx:number) => (
                <RecommendationCard key={item.id || idx} item={item} />
              ))}
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 italic">
          💬 <b>Disclaimer:</b> This is educational content, not financial advice. Consult a licensed advisor for personalized guidance.
        </div>
      </div>
    </main>
  );
}

function ProfileCard({ title, profile, color }: { title: string; profile: any; color: "blue" | "purple" }) {
  const colorClasses = color === "blue" 
    ? { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900", badge: "bg-blue-100 text-blue-700" }
    : { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-900", badge: "bg-purple-100 text-purple-700" };

  if (!profile) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className={`${colorClasses.bg} px-6 py-4 border-b ${colorClasses.border}`}>
          <h2 className={`text-lg font-bold ${colorClasses.text}`}>{title}</h2>
        </div>
        <div className="p-6 text-center text-slate-500">
          <div className="text-4xl mb-2">📊</div>
          <div>No profile data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
      <div className={`${colorClasses.bg} px-6 py-4 border-b ${colorClasses.border}`}>
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-bold ${colorClasses.text}`}>{title}</h2>
          <span className={`px-3 py-1 ${colorClasses.badge} text-sm font-bold rounded-full uppercase`}>
            {profile.persona}
          </span>
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Subscriptions */}
        <MetricGroup title="💳 Subscriptions" metrics={[
          { label: "Active Subscriptions", value: profile.subscriptionCount, unit: "" },
          { label: "Monthly Recurring", value: profile.monthlyRecurring.toFixed(0), unit: "$", prefix: true },
          { label: "Share of Spending", value: (profile.subscriptionShare * 100).toFixed(1), unit: "%", suffix: true },
        ]} />

        {/* Savings */}
        <MetricGroup title="💰 Savings & Emergency Fund" metrics={[
          { label: "Net Savings Inflow", value: profile.netSavingsInflow.toFixed(0), unit: "$/mo", suffix: true },
          { label: "Savings Growth Rate", value: (profile.savingsGrowthRate * 100).toFixed(1), unit: "%", suffix: true },
          { label: "Emergency Coverage", value: profile.emergencyMonths.toFixed(2), unit: " months", suffix: true },
        ]} />

        {/* Credit */}
        <MetricGroup title="💎 Credit Utilization" metrics={[
          { label: "Max Utilization", value: (profile.utilMax * 100).toFixed(0), unit: "%", suffix: true },
          { label: "Utilization Flags", value: profile.utilFlags || "none", unit: "" },
        ]} />

        {/* Income */}
        <MetricGroup title="💵 Income Stability" metrics={[
          { label: "Median Income Gap", value: profile.incomeMedianGap, unit: " days", suffix: true },
          { label: "Cash Flow Buffer", value: profile.cashBufferMonths.toFixed(2), unit: " months", suffix: true },
        ]} />
      </div>
    </div>
  );
}

function MetricGroup({ title, metrics }: { title: string; metrics: Array<{label: string; value: any; unit: string; prefix?: boolean; suffix?: boolean}> }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      <div className="grid grid-cols-1 gap-3">
        {metrics.map((m, i) => (
          <div key={i} className="flex justify-between items-baseline bg-slate-50 rounded-lg px-3 py-2">
            <span className="text-sm text-slate-600">{m.label}</span>
            <span className="font-bold text-slate-900">
              {m.prefix && m.unit}
              {m.value}
              {m.suffix && m.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationCard({ item }: { item: any }) {
  const icons: Record<string, string> = {
    article: "📄",
    offer: "🎁",
    tool: "🔧",
    education: "📚",
  };
  
  return (
    <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50 hover:bg-emerald-100 transition-colors">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{icons[item.kind] || "💡"}</div>
        <div className="flex-1">
          <h3 className="font-bold text-emerald-900 mb-1">{item.title}</h3>
          <p className="text-sm text-emerald-800">{item.rationale}</p>
        </div>
      </div>
    </div>
  );
}

