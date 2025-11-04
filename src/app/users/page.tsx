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
      <ul className="divide-y bg-white rounded-xl shadow">
        {users.map(u=> (
          <li key={u.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{u.name}</div>
              <div className="text-sm text-slate-500">{u.email}</div>
            </div>
            <div className="flex gap-2">
              <a className="underline" href={`/api/profile/${u.id}`} target="_blank">Profile JSON</a>
              <a className="underline" href={`/api/recommendations/${u.id}`} target="_blank">Recs JSON</a>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

