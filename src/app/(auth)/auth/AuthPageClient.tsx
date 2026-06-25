"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthBranding } from "@/components/auth/AuthBranding";
import { SignInForm } from "@/components/auth/SignInForm";
import { SignUpPanel } from "@/components/auth/SignUpPanel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AuthMode = "signin" | "signup";
type SignUpTab = "organization" | "staff";

export default function AuthPageClient() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [signUpTab, setSignUpTab] = useState<SignUpTab>("organization");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    const requestedTab = searchParams.get("tab");
    const error = searchParams.get("error");

    if (requestedMode === "signup") {
      setMode("signup");
    }
    if (requestedTab === "staff" || requestedTab === "organization") {
      setSignUpTab(requestedTab);
    }
    if (error === "profile-not-found") {
      setAuthError(
        "Your login succeeded but your profile was not found. Try signing in again or contact support."
      );
      toast.error("Profile not found for this account");
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <AuthBranding
            subtitle={
              mode === "signin"
                ? "Sign in to your organization account"
                : "Create an account for your organization"
            }
          />
        </CardHeader>
        <CardContent>
          {authError && (
            <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {authError}
            </div>
          )}
          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as AuthMode)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <SignInForm onSwitchToSignUp={() => setMode("signup")} />
            </TabsContent>

            <TabsContent value="signup">
              <SignUpPanel
                tab={signUpTab}
                onTabChange={setSignUpTab}
                onSwitchToSignIn={() => setMode("signin")}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
