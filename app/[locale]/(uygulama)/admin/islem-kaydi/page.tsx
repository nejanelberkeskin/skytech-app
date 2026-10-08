import RoleGuard from "@/components/RoleGuard";
import AuditHistory from "@/components/admin/access/AuditHistory";
export default function Page() {
  return (
    <RoleGuard path="/admin/islem-kaydi">
      <AuditHistory />
    </RoleGuard>
  );
}
