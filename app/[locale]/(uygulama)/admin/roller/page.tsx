import RoleGuard from "@/components/RoleGuard";
import RoleCatalog from "@/components/admin/access/RoleCatalog";
export default function Page() {
  return (
    <RoleGuard path="/admin/roller">
      <RoleCatalog />
    </RoleGuard>
  );
}
