import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/zz_prisma";
import { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Promote a user to OPERATOR role
 * For demo purposes, any authenticated user can promote themselves
 * In production, this should require admin privileges
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Update user role to OPERATOR
    const user = await prisma.user.update({
      where: { email },
      data: { role: UserRole.OPERATOR },
    });

    // If updating self, return success message
    if (user.id === session.user.id) {
      return NextResponse.json({
        success: true,
        message: "You have been promoted to OPERATOR. Please sign out and sign back in to see the Operator View.",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `User ${email} has been promoted to OPERATOR`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Error promoting user to operator:", error);
    
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to promote user" },
      { status: 500 }
    );
  }
}

