import Link from "next/link";
import { APP_NAME } from "@/constants";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 prose prose-slate dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p>Last updated: June 2026</p>
        <p>
          {APP_NAME} processes account and workforce data required to operate attendance and leave
          management for your organization.
        </p>
        <h2>Data we store</h2>
        <ul>
          <li>Account email, name, role, and organization membership</li>
          <li>Attendance records (dates, status, check-in/out times)</li>
          <li>Leave requests and approval history</li>
          <li>In-app notifications</li>
        </ul>
        <h2>Where data lives</h2>
        <p>
          Data is stored in your Supabase (PostgreSQL) project. Configure your own project for
          self-hosted or desktop deployments.
        </p>
        <h2>Your responsibilities</h2>
        <p>
          Organization admins should inform staff how their data is used and retain records according
          to applicable law.
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
