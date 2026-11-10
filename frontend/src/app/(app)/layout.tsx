"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ErrorState } from "@/components/ui";

// Every page inside (app) requires login; unauthenticated visitors go to /login.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, hasToken, bootError, retryBoot } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !bootError) router.replace("/login");
  }, [loading, user, bootError, router]);

  if (!loading && !user && bootError) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <ErrorState message={bootError} onRetry={retryBoot} />
      </div>
    );
  }

  // With a stored token, show the app while /me is checked so pages fetch their data in parallel.
  if (loading && hasToken) return <AppShell>{children}</AppShell>;

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted" aria-busy="true">
        ກຳລັງໂຫຼດ…
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
