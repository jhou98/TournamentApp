import { Outlet } from "react-router-dom";
import { PageHeader, Tabs } from "../../components/ui";

/** Admin Panel: tabbed hub (Users / Teams / Tournaments / Settings). */
export function AdminHub() {
  return (
    <>
      <PageHeader title="Admin Panel" subtitle="Manage users, teams and tournament settings" />
      <Tabs
        tabs={[
          { to: "/admin/users", label: "Users" },
          { to: "/admin/teams", label: "Teams" },
          { to: "/admin/coins", label: "Coins" },
          { to: "/admin/tournaments", label: "Tournaments" },
          { to: "/admin/settings", label: "Settings" },
        ]}
      />
      <Outlet />
    </>
  );
}
