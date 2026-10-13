// KVKK aydınlatması rıza kutusu değildir; ticari ileti izni İYS kurulmadan alınmaz (Astra hukuk paketi 2026-10.5, iş 6/11).
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url).pathname;
const src = (p) => readFileSync(ROOT + p, "utf8");
const messages = (loc) => JSON.parse(src(`messages/${loc}.json`));

test("sipariş: aydınlatma kutusu yok, `kvkkNotice` rıza olarak değil gösterilme kaydı olarak yazılır", () => {
  const create = src("lib/orders/create.ts");
  assert.match(create, /kvkkNotice: \{ shownAt: at, version: LEGAL_DOCUMENTS_VERSION \}/);
  assert.doesNotMatch(create, /kvkkRead:/, "yeni siparişte okundu-rıza kaydı yazılmaz");
  assert.doesNotMatch(src("components/vitrin/siparis/OrderReview.tsx"), /"kvkkRead"/, "onay bölümünde KVKK kutusu yok");
  assert.match(src("components/vitrin/siparis/OrderReview.tsx"), /<PrivacyNotice \/>/);
  assert.match(src("components/vitrin/siparis/OrderWizard.tsx"), /step === 3 && mode !== "request" && <PrivacyNotice \/>/, "veri alınırken görünür");
  const prep = src("lib/orders/preparation.ts");
  assert.match(prep, /const required = \["preInfo", "contract",/);
  assert.match(prep, /notice\.version !== order\.documents_version/, "bildirim sürümü sipariş ekiyle aynı olmalı");
});

test("ticari ileti izni: bayrak varsayılan kapalı; kapalıyken kutu yok ve sunucu izni kaydetmez", () => {
  assert.match(src("lib/site-config.ts"), /MARKETING_CONSENT_ENABLED = process\.env\.NEXT_PUBLIC_MARKETING_CONSENT_ENABLED === "true"/);
  assert.match(src("components/vitrin/siparis/OrderReview.tsx"), /\{MARKETING_CONSENT_ENABLED && checkbox\("marketing"\)\}/);
  const create = src("lib/orders/create.ts");
  assert.match(create, /marketing: rec\(MARKETING_CONSENT_ENABLED && payload\.consents\.marketing\)/);
  assert.match(create, /marketing_consent: MARKETING_CONSENT_ENABLED && payload\.consents\.marketing/);
});

test("talep ve bilgi formu: kutu yalnız iletişim isteği; aydınlatma ayrı bildirim; üç dilde 'okudum' kalıbı yok", () => {
  for (const loc of ["tr", "en", "ru"]) {
    const m = messages(loc);
    for (const text of [m.requestForms.common.consent, m.infoPage.form.consent]) {
      assert.doesNotMatch(text, /okudum|have read|прочитал/i, `${loc}: kutu metni aydınlatma beyanı değil`);
      assert.doesNotMatch(text, /kvkk>/i);
    }
    for (const text of [m.requestForms.common.privacyNotice, m.infoPage.form.privacyNotice, m.orderWizard.privacyNotice]) assert.match(text, /<kvkk>.+<\/kvkk>/);
    assert.equal(m.orderWizard.consents.kvkkRead, undefined);
    assert.ok(m.orderWizard.certificate.mode.anonymous && m.orderWizard.errors.certificateNameThirdParty);
  }
  assert.match(src("components/vitrin/talep/ContactFields.tsx"), /t\.rich\("privacyNotice"/);
  assert.match(src("components/vitrin/bilgi-al/InfoForm.tsx"), /t\.rich\("form\.privacyNotice"/);
});
