// Canlıya henüz uygulanmamış migration'lar (019 ve sonrası) dosya düzeyinde işlem denetimi taşımaz: tek işlemi uygulayan
// araç kurar (kayıtlı uygulama betiği ya da psql --single-transaction). Dosyadaki COMMIT aracın işlemini erken bitirir;
// gövde kalıcı olur, tarihçe kaydı işlem dışında kalır ("uygulanmış ama tarihçede yok" — outputs/claude-d1-mekanizma, M6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../../supabase/migrations/', import.meta.url);
const UNAPPLIED_FROM = 19; // canlı tarihçenin son kaydı legacy_surface_018 (list_migrations, 2 Ekim 2026)

// Yorumları, tek tırnaklı dizgeleri ve dolar alıntılı gövdeleri (fonksiyon, DO bloğu) çıkarır: içlerindeki BEGIN/END
// PL/pgSQL bloğudur, işlem denetimi değildir.
const topLevelSql = (sql) =>
  sql
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$/g, ' ')
    .replace(/'(?:[^']|'')*'/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
// Üst düzey ifadeler içinde işlem denetimiyle BAŞLAYANLAR (CASE … END gibi ifade içi END sayılmaz).
const transactionControl = (sql) =>
  topLevelSql(sql)
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => /^(BEGIN|COMMIT|ROLLBACK|ABORT|END|START TRANSACTION|SAVEPOINT|RELEASE)\b/i.test(s))
    .map((s) => `${s};`);

const unapplied = readdirSync(DIR)
  .filter((f) => /^\d{3}_.+\.sql$/.test(f) && Number(f.slice(0, 3)) >= UNAPPLIED_FROM)
  .sort();

test('019 ve sonrası migration dosyalarında dosya düzeyinde BEGIN/COMMIT yok', () => {
  for (const f of ['019_audit_hardening.sql', '020_refund_reconciliation.sql', '021_permission_core.sql', '022_custom_roles.sql', '023_invitation_ownership.sql']) {
    assert.ok(unapplied.includes(f), `${f} denetim kapsamında olmalı`);
  }
  for (const f of unapplied) {
    assert.deepEqual(transactionControl(readFileSync(new URL(f, DIR), 'utf8')), [], `${f} işlem denetimi taşımamalı`);
  }
});

test('denetim gerçekten yakalar: üst düzey BEGIN/COMMIT yakalanır; DO, fonksiyon gövdesi ve CASE … END yakalanmaz', () => {
  assert.deepEqual(transactionControl('-- not\nBEGIN;\nCREATE TABLE t(a int);\nCOMMIT;\n'), ['BEGIN;', 'COMMIT;']);
  assert.deepEqual(transactionControl('START TRANSACTION;\nSELECT 1;\nEND;'), ['START TRANSACTION;', 'END;']);
  assert.deepEqual(transactionControl('UPDATE t SET a = CASE WHEN b THEN 1 ELSE 2 END;'), []);
  assert.deepEqual(
    transactionControl(
      "DO $$ BEGIN PERFORM 1; END $$;\nCREATE FUNCTION f() RETURNS int LANGUAGE plpgsql AS $fn$\nBEGIN\n  RETURN 1;\nEND;\n$fn$;\nCOMMENT ON FUNCTION f() IS 'BEGIN; COMMIT;';",
    ),
    [],
  );
});
