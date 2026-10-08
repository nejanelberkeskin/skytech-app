import RoleGuard from "@/components/RoleGuard";
import Dashboard from "@/components/admin/operations/Dashboard";

export default function AdminDashboard() {
  return <RoleGuard path="/admin"><Dashboard /></RoleGuard>;
}
