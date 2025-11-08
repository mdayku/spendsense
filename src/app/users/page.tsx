"use client";
import React from "react";

export default function UsersPage() {
  const [q, setQ] = React.useState("");
  const [users, setUsers] = React.useState<any[]>([]);
  const load = async (query="") => {
    const res = await fetch(`/api/users${query?`?q=${encodeURIComponent(query)}`:""}`);
    const data = await res.json();
    setUsers(data.users || []);
  };
  React.useEffect(()=>{ load(); },[]);

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <div className="flex gap-2">
        <input className="border rounded px-3 py-2 w-full" placeholder="Search name or email" value={q} onChange={e=>setQ(e.target.value)} />
        <button className="px-3 py-2 rounded bg-black text-white" onClick={()=>load(q)}>Search</button>
      </div>
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-200">
          {users.map((u: any) => (
            <div key={u.id} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-slate-900">{u.name}</div>
                    {u.amlSeverity === "red" && (
                      <span className="text-red-600 text-lg" title={u.amlWarning || "AML/Fraud alert"}>
                        🔴
                      </span>
                    )}
                    {u.amlSeverity === "yellow" && (
                      <span className="text-yellow-600 text-lg" title={u.amlWarning || "Potential AML pattern detected"}>
                        ⚠️
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600">{u.email}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="text-xs text-slate-500">
                      Joined {new Date(u.createdAt).toLocaleDateString()}
                    </div>
                    {u.amlWarning && (
                      <div className={`text-xs px-2 py-0.5 rounded ${
                        u.amlSeverity === "red" 
                          ? "bg-red-100 text-red-700" 
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {u.amlWarning}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`/profiles/${u.id}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View Profile
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

