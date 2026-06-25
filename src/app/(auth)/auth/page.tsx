import { Suspense } from "react";
import AuthPage from "./AuthPageClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AuthBranding } from "@/components/auth/AuthBranding";

function AuthFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <AuthBranding subtitle="Loading..." />
        </CardHeader>
        <CardContent className="h-64" />
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <AuthPage />
    </Suspense>
  );
}
