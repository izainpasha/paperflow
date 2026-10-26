import { AppSidebar } from "@/components/app-sidebar";
import { SetupRequired } from "@/components/setup-required";
import { requireUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export default async function DocumentsLayout({ children }: LayoutProps<"/documents">) {
  if (!isSupabaseConfigured()) return <SetupRequired />;
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppSidebar email={user.email} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
