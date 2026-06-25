/**
 * /davet/[code] — Davet Karşılama Sayfası (Server Component)
 *
 * - Referral kodu DB'de sorgulanır (service role, herkese açık okuma)
 * - Referrer adı DavetCard'a prop olarak geçilir
 * - DavetCard (client): cookie yazar + /bireysel/satin-al'a yönlendirir
 */

import { createServiceRoleClient } from "@/lib/supabase/server";
import DavetCard from "./DavetCard";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function DavetPage({ params }: Props) {
  const { code } = await params;
  const upperCode = code.toUpperCase();

  const supabase = createServiceRoleClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("referral_code", upperCode)
    .single();

  const found                = !!profile;
  const referrerFirstName    = profile?.full_name?.split(" ")[0] ?? "Bir üye";
  const referrerDisplayName  = profile?.full_name ?? "Bir üye";

  return (
    <DavetCard
      code={upperCode}
      referrerFirstName={referrerFirstName}
      referrerDisplayName={referrerDisplayName}
      found={found}
    />
  );
}

// Open Graph / SEO
export async function generateMetadata({ params }: Props) {
  const { code } = await params;
  const supabase = createServiceRoleClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("referral_code", code.toUpperCase())
    .single();

  const name = profile?.full_name ?? "Bir üye";

  return {
    title:       `${name} sizi Skytech Green'e davet ediyor!`,
    description: "Bu davet linkiyle ilk tohum alımınızda +5 tohum hediye kazanın. Birlikte ormanları büyütelim.",
    openGraph: {
      title:       `${name} sizi Skytech Green'e davet ediyor! 🌱`,
      description: "Bu davet linkiyle ilk tohum alımınızda +5 ekstra tohum hediye! Geleceği birlikte inşa ediyoruz.",
    },
  };
}
