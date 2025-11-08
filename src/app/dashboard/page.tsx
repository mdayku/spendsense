"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [includeAmlPatterns, setIncludeAmlPatterns] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const handleGenerateSynthetic = async (force: boolean = false) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (force) queryParams.set("force", "true");
      if (includeAmlPatterns) queryParams.set("includeAml", "true");
      
      const res = await fetch(`/api/user/generate-synthetic${queryParams.toString() ? `?${queryParams.toString()}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force, includeAmlPatterns }),
      });

      if (!res.ok) {
        let errorMessage = "Failed to generate synthetic data";
        try {
          const data = await res.json();
          errorMessage = data?.error || errorMessage;
        } catch {
          // If JSON parsing fails, use the status text
          errorMessage = res.statusText || errorMessage;
        }
        
        // If 400 error and message indicates existing data, show confirmation dialog
        if (res.status === 400 && errorMessage.includes("already has transaction data")) {
          setShowConfirmDialog(true);
          setLoading(false);
          return;
        }
        
        throw new Error(errorMessage);
      }

      router.push(`/profiles/${session.user.id}`);
    } catch (err: unknown) {
      // Safely extract error message without circular references
      let errorMessage = "Failed to generate data";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      }
      
      // Check if it's a database connection error
      if (errorMessage.includes("Can't reach database server") || errorMessage.includes("database server")) {
        errorMessage = "Database connection issue. Your Supabase database may be paused. Please wait a moment and try again, or check your Supabase dashboard.";
      }
      
      // Use console.error for debugging but don't pass the error object to alert
      console.error("Error generating synthetic data:", errorMessage);
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRegenerate = async () => {
    setShowConfirmDialog(false);
    await handleGenerateSynthetic(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/user/upload-data", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload data");
      }

      router.push(`/profiles/${session.user.id}`);
    } catch (err: unknown) {
      // Safely extract error message without circular references
      let errorMessage = "Failed to upload data";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      }
      alert(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Welcome, {session.user?.name}</h1>
          <p className="text-slate-600">Your SpendSense dashboard</p>
        </div>
        <div className="flex gap-4">
          <Link
            href={`/profiles/${session.user.id}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            View Profile
          </Link>
          <Link
            href="/operator"
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Operator View
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-white shadow flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Generate Demo Data</h2>
          <p className="text-sm text-gray-600 mb-4 flex-grow">
            Get started instantly with synthetic transaction data to explore SpendSense features.
          </p>
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAmlPatterns}
                onChange={(e) => setIncludeAmlPatterns(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>
                Include AML-like patterns{" "}
                <span className="text-xs text-gray-500">
                  (learns from IBM AML dataset if available)
                </span>
              </span>
            </label>
          </div>
          <button
            onClick={() => handleGenerateSynthetic(false)}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
          >
            {loading ? "Generating..." : "Generate Synthetic Data"}
          </button>
        </div>

        <div className="p-6 rounded-xl bg-white shadow flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Upload Real Data</h2>
          <p className="text-sm text-gray-600 mb-4 flex-grow">
            Upload your own transaction data in CSV or JSON format.
          </p>
          <label className="block w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-center cursor-pointer mt-auto">
            {uploading ? "Uploading..." : "Choose File to Upload"}
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Delete Existing Data?</h3>
            <p className="text-gray-600 mb-6">
              You already have transaction data. Generating new demo data will delete all existing transactions, accounts, and profiles. This cannot be undone.
            </p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRegenerate}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Deleting..." : "Yes, Delete & Regenerate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

