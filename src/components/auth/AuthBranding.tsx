import Link from "next/link";
import { Building2 } from "lucide-react";
import { APP_NAME, APP_TAGLINE, AUTH_PATH } from "@/constants";

interface AuthBrandingProps {
  subtitle?: string;
  href?: string;
}

export function AuthBranding({ subtitle, href = AUTH_PATH }: AuthBrandingProps) {
  return (
    <Link
      href={href}
      className="block text-center space-y-4 rounded-lg transition-opacity hover:opacity-80"
      aria-label="Go to home"
    >
      <div className="mx-auto h-16 w-16 rounded-2xl bg-primary flex items-center justify-center">
        <Building2 className="h-8 w-8 text-primary-foreground" />
      </div>
      <div>
        <h1 className="text-2xl font-bold">{APP_NAME}</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle || APP_TAGLINE}</p>
      </div>
    </Link>
  );
}
