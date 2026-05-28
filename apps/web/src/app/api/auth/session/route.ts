import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-server";

export async function GET() {
  const { user, profile } = await getCurrentAuthContext();

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email
    },
    profile
  });
}
