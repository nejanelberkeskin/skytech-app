import RoleGuard from "@/components/RoleGuard";
import SecurityPanel from "@/components/admin/access/SecurityPanel";
import { AccessPage } from "@/components/admin/access/shared";
export default function Page() {
  return (
    <RoleGuard path="/admin/guvenlik">
      <AccessPage
        title="Hesap güvenliği"
        description="Kendi doğrulama uygulamanızı kurun veya hassas işlem öncesinde kimliğinizi yeniden doğrulayın."
      >
        <SecurityPanel />
      </AccessPage>
    </RoleGuard>
  );
}
