import RoleGuard from "@/components/RoleGuard";
import PaymentReview from "@/components/admin/b2b/PaymentReview";
export default function B2bPaymentReviewPage(){return <RoleGuard path="/admin/finans"><PaymentReview/></RoleGuard>;}
