"use client";
import { Link } from "@/i18n/navigation";

export default function ApplicationLink({ children }: { children: React.ReactNode }) {
  return <Link href="#basvuru" className="vitrin-cta-primary justify-center text-center"
    onClick={(event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = document.getElementById("basvuru");
      if (!target) return;
      event.preventDefault();
      const url = new URL(window.location.href);
      url.hash = "basvuru";
      window.history.replaceState(window.history.state, "", url);
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start", behavior: "instant" });
    }}>{children}</Link>;
}
