-- ════════════════════════════════════════════════════════════════════════
-- Migration 007: Admin Audit Log
-- ════════════════════════════════════════════════════════════════════════
-- Tüm admin işlemlerini izler: kim, ne zaman, ne yaptı, hangi kayıt.

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    UUID NOT NULL,                            -- admin_users.user_id
  admin_email TEXT NOT NULL,
  action      TEXT NOT NULL,                            -- 'CREATE' | 'UPDATE' | 'DELETE'
  entity      TEXT NOT NULL,                            -- 'order' | 'land' | 'catalog' | 'user' | 'quote' | 'setting'
  entity_id   TEXT,                                     -- İlgili kaydın ID'si
  details     JSONB DEFAULT '{}'::JSONB,                -- Değişiklik detayları
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Performans indexleri
CREATE INDEX IF NOT EXISTS idx_audit_admin_id   ON admin_audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity     ON admin_audit_logs (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action     ON admin_audit_logs (action);

-- RLS: Sadece service role erişebilir (admin panelde okunur)
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin kullanıcılar kendi audit loglarını okuyabilir (SUPER_ADMIN tüm logları)
CREATE POLICY "Admins can read audit logs"
  ON admin_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );
