-- Dedicated B2B resolution permission; apply in one recorded transaction after 022/037.
-- Only the existing all-power owner role gains it. Other staff need explicit role assignment.
CREATE OR REPLACE FUNCTION public.admin_permission_keys() RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'orders.read','orders.note','orders.assign','orders.cancel','orders.documents.read','orders.export',
    'customers.contact.read','customers.tax.read','customers.export',
    'refunds.request','refunds.approve','refunds.execute','invoices.read','invoices.manage','finance.read','finance.b2b_payment.resolve',
    'sites.read','sites.edit','sites.publish','sites.capacity.manage',
    'batches.read','batches.plan','batches.assign','batches.release',
    'monitoring.edit','monitoring.review','monitoring.publish','certificates.read_private','certificates.resend',
    'requests.read','requests.assign','requests.update','messages.send',
    'content.edit','content.publish','media.upload','legal.edit','legal.publish',
    'staff.invite','staff.manage','roles.manage','audit.read',
    'sales.pause','sales.resume','sales.pricing.manage','system.readiness.read','system.jobs.run'];
$$;
-- The migration owner is the only role allowed to change a protected system role.
-- Transactional DDL restores the trigger even on rollback; no staff endpoint bypass is added.
ALTER TABLE public.admin_roles DISABLE TRIGGER protect_system_roles;
UPDATE public.admin_roles SET permissions=array_append(permissions,'finance.b2b_payment.resolve'),updated_at=now()
 WHERE key='owner' AND NOT ('finance.b2b_payment.resolve'=ANY(permissions));
ALTER TABLE public.admin_roles ENABLE TRIGGER protect_system_roles;
