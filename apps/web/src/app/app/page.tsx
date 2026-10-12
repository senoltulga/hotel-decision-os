import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import Model from "./model";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const sb = await supabaseServer();
  if (!sb) redirect("/login");
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/login");
  return <Model email={data.user.email ?? ""} />;
}
