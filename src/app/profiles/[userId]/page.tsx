"use client";
import React from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function ProfileView({ params }: { params: { userId: string } }) {
  const { userId } = params;
  const [profileData, setProfileData] = React.useState<any>(null);
  const [recs, setRecs] = React.useState<any>(null);
  const [alerts, setAlerts] = React.useState<{alerts30:string[];alerts180:string[]}>({alerts30:[],alerts180:[]});
  const [labels, setLabels] = React.useState<number>(0);
  const [chartData, setChartData] = React.useState<any>(null);

  const [refreshing, setRefreshing] = React.useState(false);
  
  const loadData = React.useCallback(async () => {
    try {
      const pRes = await fetch(`/api/profile/${userId}`);
      if (!pRes.ok) {
        const errorData = await pRes.json().catch(() => ({ error: "Failed to fetch profile" }));
        throw new Error(errorData.error || `HTTP ${pRes.status}`);
      }
      const p = await pRes.json();
      
      const rRes = await fetch(`/api/recommendations/${userId}`);
      const r = rRes.ok ? await rRes.json() : { items: [] };
      
      // Log AI status to browser console
      if (r.items && r.items.length > 0) {
        const aiGenerated = r.items.filter((item: any) => item.aiGenerated === true).length;
        const fallback = r.items.filter((item: any) => item.aiGenerated === false).length;
        console.log(`[Recommendations] Loaded ${r.items.length} recommendations:`, {
          '✨ AI-generated': aiGenerated,
          '📝 Fallback copy': fallback,
          'Total': r.items.length
        });
        if (aiGenerated > 0) {
          console.log('✅ OpenAI is working! AI-generated recommendations:', 
            r.items.filter((item: any) => item.aiGenerated).map((item: any) => item.id));
        } else {
          console.warn('⚠️ OpenAI may not be working. All recommendations are using fallback copy.');
        }
      }
      
      const aRes = await fetch(`/api/alerts/${userId}`);
      const a = aRes.ok ? await aRes.json() : { alerts30: [], alerts180: [] };
      
      const lRes = await fetch(`/api/aml/labels/${userId}`);
      const l = lRes.ok ? await lRes.json() : { count: 0 };
      
      const cRes = await fetch(`/api/profile/${userId}/charts`);
      const c = cRes.ok ? await cRes.json() : null;
      
      setProfileData(p); 
      setRecs(r); 
      setAlerts(a); 
      setLabels(l.count || 0);
      setChartData(c);
    } catch (error: any) {
      console.error("Failed to load profile data:", error);
      alert(`Failed to load profile: ${error.message || "Unknown error"}`);
    }
  }, [userId]);
  
  const recomputeProfile = async () => {
    setRefreshing(true);
    try {
      await fetch(`/api/profile/${userId}`, { method: 'POST' });
      await loadData();
    } catch (e) {
      console.error('Failed to recompute profile:', e);
    }
    setRefreshing(false);
  };
  
  React.useEffect(() => {
    loadData();
  }, [loadData]);

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
        <div className="flex gap-3 items-center">
          <button
            onClick={recomputeProfile}
            disabled={refreshing}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {refreshing ? "↻ Recomputing..." : "↻ Recompute Profile"}
          </button>
          <a href="/users" className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 underline">
            ← Back to Users
          </a>
        </div>
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

      {/* Charts Section */}
      {chartData && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">📊 Financial Insights</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Spending by Category */}
            {chartData.spendingByCategory && chartData.spendingByCategory.length > 0 && (
              <ChartCard title="Spending by Category">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData.spendingByCategory}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props: any) => `${props.name} ${((props.percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.spendingByCategory.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Payment Channels */}
            {chartData.paymentChannels && chartData.paymentChannels.length > 0 && (
              <ChartCard title="Payment Channels">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData.paymentChannels}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props: any) => `${props.name} ${((props.percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.paymentChannels.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* Spending Over Time */}
          {chartData.spendingOverTime && chartData.spendingOverTime.length > 0 && (
            <ChartCard title="Spending Over Time">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData.spendingOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="amount" stroke="#8884d8" strokeWidth={2} name="Spending" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Income vs Expenses */}
          {chartData.incomeVsExpenses && chartData.incomeVsExpenses.length > 0 && (
            <ChartCard title="Income vs Expenses">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData.incomeVsExpenses}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  <Legend />
                  <Area type="monotone" dataKey="income" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Income" />
                  <Area type="monotone" dataKey="expenses" stackId="1" stroke="#ffc658" fill="#ffc658" name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}

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
          { label: "Net Savings Inflow", value: profile.netSavingsInflow.toFixed(0), unit: "$", prefix: true, suffix: "/mo" },
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

function MetricGroup({ title, metrics }: { title: string; metrics: Array<{label: string; value: any; unit: string; prefix?: boolean; suffix?: boolean | string}> }) {
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
              {m.suffix && (typeof m.suffix === "string" ? m.suffix : m.unit)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      </div>
      <div className="p-6">
        {children}
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
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-emerald-900">{item.title}</h3>
            {item.aiGenerated && (
              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium" title="AI-generated recommendation">
                ✨ AI
              </span>
            )}
          </div>
          <p className="text-sm text-emerald-800">{item.rationale}</p>
        </div>
      </div>
    </div>
  );
}

