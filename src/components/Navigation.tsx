"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const { data: session } = useSession();
  const pathname = usePathname();

  // Don't show navigation on auth pages
  if (pathname?.startsWith("/auth")) {
    return null;
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-blue-600">
              SpendSense
            </Link>
            {session && (
              <>
                <Link
                  href="/dashboard"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === "/dashboard"
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href={`/profiles/${session.user.id}`}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname?.startsWith("/profiles")
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  My Profile
                </Link>
                {session.user.role === "OPERATOR" && (
                  <Link
                    href="/operator"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      pathname === "/operator"
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    Operator View
                  </Link>
                )}
              </>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {session ? (
              <>
                <span className="text-sm text-gray-700">{session.user?.name}</span>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/auth/signin"
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

