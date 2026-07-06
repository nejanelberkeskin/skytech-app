import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware Link, useRouter, redirect, usePathname, getPathname.
// Vitrin component'leri next/link yerine bu Link'i import etmeli.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
