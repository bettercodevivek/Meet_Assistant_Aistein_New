import Sidebar from '@/components/Sidebar';
import { BatchAutomationBackgroundSync } from '@/components/BatchAutomationBackgroundSync';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-secondary">
      <BatchAutomationBackgroundSync />
      <Sidebar />
      <div className="lg:pl-60">
        <div className="h-14 shrink-0 lg:hidden" aria-hidden />
        <main className="mx-auto w-full max-w-content px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
