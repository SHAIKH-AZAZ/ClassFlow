import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ConfirmHost } from "@/components/confirm-dialog";
import "./globals.css";

export const metadata: Metadata = {
  title: "Institute Zoom LMS",
  description: "Admin and faculty dashboard for Zoom classes, attendance, resources, and recordings."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <ConfirmHost />
      </body>
    </html>
  );
}
