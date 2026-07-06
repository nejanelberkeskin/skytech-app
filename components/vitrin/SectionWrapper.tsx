import { ReactNode } from "react";

interface SectionWrapperProps {
  id?: string;
  className?: string;
  variant?: "light" | "dark" | "tinted";
  containerClassName?: string;
  children: ReactNode;
}

export default function SectionWrapper({
  id,
  className = "",
  variant = "light",
  containerClassName = "",
  children,
}: SectionWrapperProps) {
  const bgClass =
    variant === "dark"
      ? "bg-[#0a1f12] text-[#e0f0e0]"
      : variant === "tinted"
      ? "bg-[#f8faf5]"
      : "bg-white";

  return (
    <section id={id} className={`vitrin-section ${bgClass} ${className}`}>
      <div className={`vitrin-container ${containerClassName}`}>{children}</div>
    </section>
  );
}
