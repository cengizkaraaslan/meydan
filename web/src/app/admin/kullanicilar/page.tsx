import { auth } from "@/auth";
import { UsersAdminClient } from "@/components/admin/UsersAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth().catch(() => null);
  const adminEmail = session?.user?.email ?? "";
  return <UsersAdminClient adminEmail={adminEmail} />;
}
