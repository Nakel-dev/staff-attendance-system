import Link from "next/link";
import { APP_NAME } from "@/constants";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 prose prose-slate dark:prose-invert">
        <h1>Terms of Service</h1>
        <p>Last updated: June 2026</p>
        <p>
          By using {APP_NAME}, you agree to these terms. {APP_NAME} is provided for staff attendance
          and leave management within your organization.
        </p>
        <h2>Use of the service</h2>
        <ul>
          <li>You are responsible for accounts created in your organization.</li>
          <li>You must not attempt to bypass security or access other organizations&apos; data.</li>
          <li>Attendance and leave records should comply with your local employment laws.</li>
        </ul>
        <h2>Data</h2>
        <p>
          Your data is stored in your configured Supabase project. You retain ownership of your
          organization data.
        </p>
        <h2>Disclaimer</h2>
        <p>
          The software is provided &quot;as is&quot; without warranty. The licensor is not liable for
          indirect or consequential damages arising from use of the software.
        </p>
        <p>
          <Link href="/auth" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
