import RoleGuard from "@/components/RoleGuard";
import Invitations from "@/components/admin/access/Invitations";
export default function Page() {
  return (
    <RoleGuard path="/admin/davetler">
      <Invitations />
    </RoleGuard>
  );
}
