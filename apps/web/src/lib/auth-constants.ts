export type AppRole = "admin" | "faculty" | "student";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  role: AppRole;
  active: boolean;
};

export const roleHome: Record<AppRole, string> = {
  admin: "/admin",
  faculty: "/faculty",
  student: "/student"
};

type NavItem = {
  label: string;
  href: string;
  roles: AppRole[];
};

export const navItems: NavItem[] = [
  { label: "Admin", href: "/admin", roles: ["admin"] },
  { label: "Faculty", href: "/faculty", roles: ["admin", "faculty"] },
  { label: "Student", href: "/student", roles: ["admin", "student"] },
  { label: "Notices", href: "/notices", roles: ["admin", "faculty", "student"] },
  { label: "Chat", href: "/chat", roles: ["admin", "faculty", "student"] },
  { label: "Reports", href: "/reports", roles: ["admin", "faculty"] },
  { label: "Integrations", href: "/settings", roles: ["admin"] }
];

const pageAccess: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/faculty", roles: ["admin", "faculty"] },
  { prefix: "/student", roles: ["admin", "student"] },
  { prefix: "/notices", roles: ["admin", "faculty", "student"] },
  { prefix: "/chat", roles: ["admin", "faculty", "student"] },
  { prefix: "/reports", roles: ["admin", "faculty"] },
  { prefix: "/settings", roles: ["admin"] },
  { prefix: "/", roles: ["admin", "faculty", "student"] }
];

export function getAllowedRolesForPath(pathname: string) {
  return pageAccess.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`))?.roles ?? null;
}

export function isRoleAllowed(role: AppRole, roles: AppRole[]) {
  return roles.includes(role);
}

export function getRoleHome(role: AppRole | string | null | undefined) {
  if (role === "admin" || role === "faculty" || role === "student") {
    return roleHome[role];
  }

  return "/login";
}
