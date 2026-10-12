-- Saha başına teslim ayları ve izin denetimi (Astra hukuk paketi 2026-10.5, iş 3/5).
--  • certificate_month / monitoring_month: Katılım Sertifikası ve izleme içeriği teslim ayı. Sözleşmede kesin son tarih,
--    bırakma son tarihinden (31 Mart) sonraki ilk bu ayın son günüdür. İzleme vaadi Nisan–Eylül olduğundan iki ay da
--    4–9 aralığındadır; sertifika izlemeden sonra olamaz.
--  • permit_*: sahanın bırakma izni. Belge numarası/tarih girmek onay DEĞİLDİR; yetkili kişi ayrıca "doğrulandı" der.
--    Numara ya da geçerlilik tarihi değişirse doğrulama kendiliğinden düşer (tetikleyici).
-- Yalnız ekleme; eski kod bu kolonları okumaz. Ayları ya da doğrulanmış izni olmayan sahada yeni kod sipariş açmaz.
-- No transaction control here: apply the entire file in one recorded transaction.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.lands
  ADD COLUMN certificate_month smallint CHECK (certificate_month BETWEEN 4 AND 9),
  ADD COLUMN monitoring_month smallint CHECK (monitoring_month BETWEEN 4 AND 9),
  ADD COLUMN permit_status text NOT NULL DEFAULT 'missing' CHECK (permit_status IN ('missing', 'submitted', 'verified', 'rejected')),
  ADD COLUMN permit_reference text CHECK (permit_reference IS NULL OR length(btrim(permit_reference)) BETWEEN 3 AND 300),
  ADD COLUMN permit_valid_until date,
  ADD COLUMN permit_verified_by uuid,
  ADD COLUMN permit_verified_at timestamptz,
  ADD CONSTRAINT lands_delivery_order CHECK (certificate_month IS NULL OR monitoring_month IS NULL OR certificate_month <= monitoring_month),
  ADD CONSTRAINT lands_permit_verified_complete CHECK (
    permit_status <> 'verified'
    OR (permit_reference IS NOT NULL AND permit_valid_until IS NOT NULL AND permit_verified_by IS NOT NULL AND permit_verified_at IS NOT NULL)
  );
COMMENT ON COLUMN public.lands.certificate_month IS 'Katılım Sertifikası teslim ayı (4–9); sözleşmede bırakma son tarihinden sonraki ilk bu ayın son günü';
COMMENT ON COLUMN public.lands.monitoring_month IS 'İzleme içeriği teslim ayı (4–9); sözleşmede bırakma son tarihinden sonraki ilk bu ayın son günü';
COMMENT ON COLUMN public.lands.permit_status IS 'missing | submitted | verified | rejected — yalnız verified sahada sipariş açılır';

CREATE FUNCTION public.lands_permit_reverify() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Yeni sahada izin bilgisi girilmişse "gönderildi"; doğrulama yalnız sonradan ayrı kararla.
    IF NEW.permit_status = 'verified' THEN RAISE EXCEPTION 'permit_verify_on_insert'; END IF;
    IF NEW.permit_reference IS NOT NULL AND NEW.permit_status = 'missing' THEN NEW.permit_status := 'submitted'; END IF;
    RETURN NEW;
  END IF;
  -- İzin bilgisi, aynı istekte açık bir kararla (durum ya da doğrulama anı değişmeden) değişirse onay düşer.
  IF (NEW.permit_reference IS DISTINCT FROM OLD.permit_reference OR NEW.permit_valid_until IS DISTINCT FROM OLD.permit_valid_until)
     AND NEW.permit_status IS NOT DISTINCT FROM OLD.permit_status
     AND NEW.permit_verified_at IS NOT DISTINCT FROM OLD.permit_verified_at THEN
    NEW.permit_status := CASE WHEN NEW.permit_reference IS NULL THEN 'missing' ELSE 'submitted' END;
    NEW.permit_verified_by := NULL;
    NEW.permit_verified_at := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.lands_permit_reverify() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER lands_permit_reverify BEFORE INSERT OR UPDATE ON public.lands
  FOR EACH ROW EXECUTE FUNCTION public.lands_permit_reverify();
