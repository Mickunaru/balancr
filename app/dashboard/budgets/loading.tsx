import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function BudgetsLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="size-7" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="size-7" />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-32" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="mb-1.5 flex items-center justify-between">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
