import RoleGuard from "@/components/RoleGuard";
import StaffDetail from "@/components/admin/access/StaffDetail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RoleGuard path="/admin/kullanicilar">
      <StaffDetail key={id} id={id} />
    </RoleGuard>
  );
}
