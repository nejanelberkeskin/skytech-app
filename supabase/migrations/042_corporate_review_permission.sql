-- Kurumsal hesap başvurularını onaylama/reddetme izni (corporate.review). 038 deseni: yalnız owner rolü alır;
-- diğer personel rolle açıkça atanır. Apply in one recorded transaction after 038.
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
    'sales.pause','sales.resume','sales.pricing.manage','system.readiness.read','system.jobs.run',
    'corporate.review'];
$$;
ALTER TABLE public.admin_roles DISABLE TRIGGER protect_system_roles;
UPDATE public.admin_roles SET permissions=array_append(permissions,'corporate.review'),updated_at=now()
 WHERE key='owner' AND NOT ('corporate.review'=ANY(permissions));
ALTER TABLE public.admin_roles ENABLE TRIGGER protect_system_roles;
