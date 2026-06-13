import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";

const DashboardPage = lazy(() => import("./-index.page"));

export const Route = createFileRoute("/")({
  component: () => (
    <Suspense
      fallback={
        <AppLayout title="Dashboard" subtitle="Visão geral dos projetos e impacto social da Chapada">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
            <Skeleton className="h-72 w-full lg:col-span-2 rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
          <Skeleton className="h-60 w-full mt-6 rounded-xl" />
        </AppLayout>
      }
    >
      <DashboardPage />
    </Suspense>
  ),
});
