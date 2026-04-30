import VitrinNavbar from "@/components/vitrin/VitrinNavbar";
import VitrinFooter from "@/components/vitrin/VitrinFooter";
import ScrollToTop from "@/components/vitrin/ScrollToTop";
import CustomCursor from "@/components/vitrin/CustomCursor";

export default function VitrinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="light" className="min-h-screen bg-white text-[#1a2e1a]">
      <CustomCursor />
      <VitrinNavbar />
      <main>{children}</main>
      <VitrinFooter />
      <ScrollToTop />
    </div>
  );
}
