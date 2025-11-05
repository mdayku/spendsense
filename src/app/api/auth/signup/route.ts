import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/zz_prisma";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: UserRole.USER,
        consent: {
          create: {
            status: "OPTED_IN",
          },
        },
      },
    });

    return NextResponse.json({ 
      success: true, 
      userId: user.id,
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create account" },
      { status: 500 }
    );
  }
}

