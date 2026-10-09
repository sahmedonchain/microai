import { cookies } from "next/headers";
import { HomeTab } from "@/app/components/tabs/HomeTab";

export default async function Page() {
  // Read the remembered panel and sidebar state on the server so the first
  // paint is already correct (no highlight or menu jump on reload).
  const store = await cookies();
  return (
    <HomeTab
      initialPanel={store.get("microai_active_tab")?.value}
      initialSidebarCollapsed={store.get("microai_sidebar_collapsed")?.value === "1"}
      initialNavGroups={store.get("microai_nav_groups")?.value}
    />
  );
}
