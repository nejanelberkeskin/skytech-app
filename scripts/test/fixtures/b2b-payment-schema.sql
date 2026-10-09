-- Selected exact table/type definitions from 30 September 2026 read-only schema export.
-- No production rows. Unrelated auth/org foreign keys omitted; real payment/order checks below.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'cancelled', 'expired', 'confirmed', 'preparing', 'shipped', 'delivered', 'planted');
CREATE TABLE public.corporate_quotes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  company_name text,
  tax_office text,
  tax_no text,
  contact_person text,
  corporate_email text,
  phone text,
  need_types text[],
  need_details text,
  seed_count text,
  budget_range text,
  timeline text,
  notes text,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.corporate_quotes ADD CONSTRAINT corporate_quotes_pkey PRIMARY KEY (id);
ALTER TABLE public.corporate_quotes ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  buyer_email text NOT NULL,
  user_id uuid,
  org_id uuid,
  status order_status DEFAULT 'pending'::order_status NOT NULL,
  total_seeds integer NOT NULL,
  total_amount numeric(12,2) DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  order_type text DEFAULT 'reservation'::text,
  total_price numeric DEFAULT 0,
  shipping_address text,
  tracking_code text,
  payment_status text DEFAULT 'pending'::text,
  type text DEFAULT 'bireysel'::text,
  description text,
  referred_by uuid,
  updated_at timestamp with time zone,
  gift_info jsonb,
  metadata jsonb,
  is_subscription boolean DEFAULT false
);
ALTER TABLE public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_order_type CHECK ((order_type = ANY (ARRAY['physical'::text, 'reservation'::text, 'gift'::text])));
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_payment_status CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_total_seeds_check CHECK ((total_seeds > 0));
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.payments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  user_id uuid,
  iyzico_payment_id text,
  amount numeric(12,2) NOT NULL,
  currency text DEFAULT 'TRY'::text,
  status text DEFAULT 'pending'::text,
  payment_method text,
  description text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  provider text DEFAULT 'iyzico'::text
);
ALTER TABLE public.payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
ALTER TABLE public.payments ADD CONSTRAINT payments_iyzico_payment_id_key UNIQUE (iyzico_payment_id);
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'cancelled'::text])));
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
