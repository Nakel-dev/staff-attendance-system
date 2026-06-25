import { redirect } from "next/navigation";
import { AUTH_PATH } from "@/constants";

export default function HomePage() {
  redirect(AUTH_PATH);
}
