import { redirect } from "next/navigation";

export default function RegisterPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const tab = searchParams?.tab === "staff" ? "staff" : "organization";
  redirect(`/auth?mode=signup&tab=${tab}`);
}
