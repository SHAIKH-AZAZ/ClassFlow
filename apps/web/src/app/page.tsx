import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-server";
import { getRoleHome } from "@/lib/auth-constants";

export default async function HomePage() {
  const { user, profile } = await getCurrentAuthContext();
  if (!user || !profile) {
    redirect("/login");
  }
  redirect(getRoleHome(profile.role));
}
