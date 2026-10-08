import RoleGuard from "@/components/RoleGuard";
import RefundOrderPanel from "@/components/admin/operations/RefundOrderPanel";
import { Link } from "@/i18n/navigation";
export default async function RefundPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <RoleGuard path="/admin/iadeler"><div className="p-4 md:p-8 mx-auto max-w-5xl space-y-5"><Link className="inline-flex min-h-11 items-center text-emerald-300 underline" href="/admin/iadeler">← İade kuyruğuna dön</Link><h1 className="sr-only">Sipariş iade ayrıntısı</h1><RefundOrderPanel key={orderId} orderId={orderId} /></div></RoleGuard>;
}
