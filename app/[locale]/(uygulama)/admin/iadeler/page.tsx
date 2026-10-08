import RoleGuard from "@/components/RoleGuard";
import RefundQueue from "@/components/admin/operations/RefundQueue";
export default function RefundsPage() {
  return <RoleGuard path="/admin/iadeler"><RefundQueue /></RoleGuard>;
}
