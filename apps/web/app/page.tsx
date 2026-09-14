import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";

export default async function IndexPage() {
  const session = await getSession();
  redirect(session ? "/dashboard" : "/login");
}
