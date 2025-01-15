import { getSessionFromCookie } from "@/utils/auth";
import { redirect } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SettingsSidebar } from "./settings-sidebar";
import NavFooterLayout from "@/layouts/NavFooterLayout";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionFromCookie();

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <NavFooterLayout>
      <div className="container mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>

        <Separator />

        <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
          <aside className="lg:w-1/5">
            <SettingsSidebar />
          </aside>
          <div className="flex-1">
            {children}
          </div>
        </div>
      </div>
    </NavFooterLayout>
  );
}
