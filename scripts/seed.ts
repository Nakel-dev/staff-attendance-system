/**
 * Seed script for Staff Attendance Management System
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed.ts
 */
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { format, subDays } from "date-fns";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const STAFF_MEMBERS = [
  { name: "Dr. Emily Chen", email: "emily.chen@school.com", department: "Sciences", password: "Staff1234!" },
  { name: "Mr. David Miller", email: "david.miller@school.com", department: "Mathematics", password: "Staff1234!" },
  { name: "Ms. Rachel Green", email: "rachel.green@school.com", department: "English", password: "Staff1234!" },
  { name: "Mr. James Wilson", email: "james.wilson@school.com", department: "Arts", password: "Staff1234!" },
  { name: "Coach Mark Taylor", email: "mark.taylor@school.com", department: "Physical Education", password: "Staff1234!" },
  { name: "Ms. Lisa Park", email: "lisa.park@school.com", department: "ICT", password: "Staff1234!" },
  { name: "Mr. Robert Hughes", email: "robert.hughes@school.com", department: "History", password: "Staff1234!" },
  { name: "Mrs. Anna Brooks", email: "anna.brooks@school.com", department: "Library", password: "Staff1234!" },
];

const ATTENDANCE_STATUSES = ["present", "present", "present", "present", "present", "present", "present", "present", "absent", "late", "half-day"] as const;

function randomStatus() {
  return ATTENDANCE_STATUSES[Math.floor(Math.random() * ATTENDANCE_STATUSES.length)];
}

function randomTime(hour: number) {
  const h = hour + Math.floor(Math.random() * 2);
  const m = Math.floor(Math.random() * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

async function createUserWithProfile(
  email: string,
  password: string,
  fullName: string,
  department: string,
  role: "admin" | "staff"
) {
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === email);

  let userId: string;
  if (existing) {
    userId = existing.id;
    console.log(`  User exists: ${email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`  Created user: ${email}`);
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    console.log(`  Profile exists: ${fullName}`);
    return existingProfile.id;
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .insert({
      user_id: userId,
      full_name: fullName,
      email,
      department,
      role,
      is_active: true,
      date_joined: format(subDays(new Date(), 90), "yyyy-MM-dd"),
    })
    .select("id")
    .single();

  if (profileError) throw profileError;
  console.log(`  Created profile: ${fullName}`);
  return profile.id;
}

async function seed() {
  console.log("Starting seed...\n");

  console.log("Creating admin...");
  const adminProfileId = await createUserWithProfile(
    "admin@school.com",
    "Admin1234!",
    "Sarah Johnson",
    "Administration",
    "admin"
  );

  console.log("\nCreating staff members...");
  const staffIds: string[] = [];
  for (const staff of STAFF_MEMBERS) {
    const id = await createUserWithProfile(
      staff.email,
      staff.password,
      staff.name,
      staff.department,
      "staff"
    );
    staffIds.push(id);
  }

  console.log("\nClearing existing attendance and leaves...");
  await admin.from("attendance").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("leaves").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("\nGenerating 60 days of attendance...");
  const attendanceRows: Array<{
    staff_id: string;
    date: string;
    status: string;
    check_in_time: string | null;
    check_out_time: string | null;
    marked_by: string;
  }> = [];

  for (const staffId of staffIds) {
    for (let d = 0; d < 60; d++) {
      const date = format(subDays(new Date(), d), "yyyy-MM-dd");
      const dayOfWeek = subDays(new Date(), d).getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const status = randomStatus();
      attendanceRows.push({
        staff_id: staffId,
        date,
        status,
        check_in_time: status !== "absent" ? randomTime(7) : null,
        check_out_time: status !== "absent" ? randomTime(15) : null,
        marked_by: adminProfileId,
      });
    }
  }

  const batchSize = 100;
  for (let i = 0; i < attendanceRows.length; i += batchSize) {
    const batch = attendanceRows.slice(i, i + batchSize);
    const { error } = await admin.from("attendance").upsert(batch, { onConflict: "staff_id,date" });
    if (error) throw error;
  }
  console.log(`  Inserted ${attendanceRows.length} attendance records`);

  console.log("\nCreating sample leave records...");
  const leaves = [
    {
      staff_id: staffIds[0],
      leave_type: "sick",
      start_date: format(subDays(new Date(), 5), "yyyy-MM-dd"),
      end_date: format(subDays(new Date(), 4), "yyyy-MM-dd"),
      reason: "Flu symptoms",
      status: "pending",
    },
    {
      staff_id: staffIds[1],
      leave_type: "annual",
      start_date: format(subDays(new Date(), -10), "yyyy-MM-dd"),
      end_date: format(subDays(new Date(), -7), "yyyy-MM-dd"),
      reason: "Family vacation",
      status: "pending",
    },
    {
      staff_id: staffIds[2],
      leave_type: "annual",
      start_date: format(subDays(new Date(), 20), "yyyy-MM-dd"),
      end_date: format(subDays(new Date(), 15), "yyyy-MM-dd"),
      reason: "Summer holiday",
      status: "approved",
      reviewed_by: adminProfileId,
      reviewed_at: new Date().toISOString(),
    },
    {
      staff_id: staffIds[3],
      leave_type: "emergency",
      start_date: format(subDays(new Date(), 10), "yyyy-MM-dd"),
      end_date: format(subDays(new Date(), 9), "yyyy-MM-dd"),
      reason: "Family emergency",
      status: "approved",
      reviewed_by: adminProfileId,
      reviewed_at: new Date().toISOString(),
    },
    {
      staff_id: staffIds[4],
      leave_type: "sick",
      start_date: format(subDays(new Date(), 3), "yyyy-MM-dd"),
      end_date: format(subDays(new Date(), 2), "yyyy-MM-dd"),
      reason: "Medical appointment",
      status: "rejected",
      admin_note: "Insufficient documentation provided",
      reviewed_by: adminProfileId,
      reviewed_at: new Date().toISOString(),
    },
  ];

  const { error: leavesError } = await admin.from("leaves").insert(leaves);
  if (leavesError) throw leavesError;
  console.log("  Created 5 leave records");

  console.log("\nSeed completed successfully!");
  console.log("\nLogin credentials:");
  console.log("  Admin: admin@school.com / Admin1234!");
  console.log("  Staff: [staff-email] / Staff1234!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
