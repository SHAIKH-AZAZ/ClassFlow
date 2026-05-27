import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "session endpoint placeholder",
    auth: "Use Supabase Auth helpers on the client and exchange the session with server routes."
  });
}
