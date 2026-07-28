import { Suspense } from "react";
import { PhoneClockClient } from "@/components/clock/PhoneClockClient";

export default async function PhoneClockPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-8">
      <div className="mx-auto mb-6 max-w-md text-center">
        <p className="text-sm font-semibold tracking-wide text-slate-800">AttendPro</p>
        <p className="text-muted-foreground text-xs">Phone clock-in</p>
      </div>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        }
      >
        <PhoneClockClient token={token} />
      </Suspense>
    </main>
  );
}
