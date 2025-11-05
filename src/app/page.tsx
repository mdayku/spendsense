import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function Page() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">SpendSense</h1>
      <p className="text-slate-600">Personalized, explainable financial education.</p>
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-white shadow">
          <h2 className="text-xl font-semibold mb-2">Get Started</h2>
          <p className="text-sm text-gray-600 mb-4">
            Sign up to explore SpendSense with demo data or upload your own transaction history.
          </p>
          <div className="space-x-4">
            <Link
              href="/auth/signup"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Sign Up
            </Link>
            <Link
              href="/auth/signin"
              className="inline-block px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Sign In
            </Link>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white shadow">
          <h2 className="text-xl font-semibold mb-2">Features</h2>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• Generate synthetic transaction data for instant exploration</li>
            <li>• Upload your own transaction data (CSV or JSON)</li>
            <li>• Get personalized financial recommendations</li>
            <li>• View your financial profile and insights</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

