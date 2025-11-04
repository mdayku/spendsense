import Link from "next/link";
export default async function Page() {
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">SpendSense</h1>
      <p className="text-slate-600">Personalized, explainable financial education (synthetic data).</p>
      <div className="space-x-4">
        <Link href="/users" className="underline">Users</Link>
        <Link href="/operator" className="underline">Operator View</Link>
      </div>
      <div className="p-4 rounded-xl bg-white shadow">
        <p className="text-sm">Use the seed script to generate users, then query <code>/api/profile/:userId</code> and <code>/api/recommendations/:userId</code>.</p>
      </div>
    </main>
  );}

