/** Rol uçlarının ortak bağımlılığı: servis kurulumu (web-brifler/21). */
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createRolesService } from "./roles";

export const rolesService = () => createRolesService({ db: createServiceRoleClient() });
