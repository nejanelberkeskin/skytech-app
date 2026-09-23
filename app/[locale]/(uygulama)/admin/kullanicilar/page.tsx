import RoleGuard from "@/components/RoleGuard";
import StaffDirectory from "@/components/admin/access/StaffDirectory";
export default function Page() {
  return (
    <RoleGuard path="/admin/kullanicilar">
      <StaffDirectory />
    </RoleGuard>
  );
}
