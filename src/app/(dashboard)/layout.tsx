import { getCurrentUser } from "@/lib/auth/helpers";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ComingSoonGate } from "@/components/layout/coming-soon-gate";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex h-full">
      <Sidebar userRole={user.role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          <ComingSoonGate userRole={user.role}>{children}</ComingSoonGate>
        </main>
      </div>
    </div>
  );
}
