import { cookies } from "next/headers";
import { HomeTab } from "@/app/components/tabs/HomeTab";

// Renders the app shell (sidebar menu) with a fixed panel, so a direct link
// like /verify keeps the menu instead of a bare page.
export async function ShellPage({ panel }: { panel: string }) {
  const store = await cookies();
  return (
    <HomeTab
      initialPanel={panel}
      initialSidebarCollapsed={store.get("microai_sidebar_collapsed")?.value === "1"}
      initialNavGroups={store.get("microai_nav_groups")?.value}
    />
  );
}
