import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

/**
 * Get the current session and verify user is authenticated
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  
  return session;
}

/**
 * Verify user can access a resource (either owns it or is an operator)
 */
export async function verifyAccess(userId: string) {
  const session = await requireAuth();
  
  // Operators can access any resource
  if (session.user.role === UserRole.OPERATOR) {
    return true;
  }
  
  // Users can only access their own resources
  if (session.user.id !== userId) {
    throw new Error("Forbidden");
  }
  
  return true;
}

/**
 * Middleware helper for API routes
 */
export async function withAuth<T>(
  handler: (session: any, ...args: T[]) => Promise<Response>,
  ...args: T[]
): Promise<Response> {
  try {
    const session = await requireAuth();
    return await handler(session, ...args);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }
}

