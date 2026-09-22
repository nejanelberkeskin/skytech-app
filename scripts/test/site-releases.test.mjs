import assert from "node:assert/strict";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const R = await import(ROOT + "/lib/sites/releases.ts");

const ID = "aqz-KE-bpKQ";
for (const url of [
  `https://www.youtube.com/watch?v=${ID}`,
  `https://youtube.com/watch?v=${ID}&t=30s`,
  `https://www.youtube.com/watch?feature=share&v=${ID}`,
  `https://m.youtube.com/watch?v=${ID}`,
  `https://youtu.be/${ID}`,
  `https://youtu.be/${ID}?si=abc`,
  `https://www.youtube.com/embed/${ID}`,
  `https://www.youtube.com/shorts/${ID}`,
  `https://www.youtube.com/live/${ID}?feature=share`,
  `https://www.youtube-nocookie.com/embed/${ID}`,
  `  https://youtu.be/${ID}  `,
]) assert.equal(R.youtubeIdFrom(url), ID, url);

for (const bad of [
  null, undefined, "", "youtube.com/watch?v=" + ID, `http://www.youtube.com/watch?v=${ID}`,
  "https://www.youtube.com/watch?v=kisa", `https://evil.example/watch?v=${ID}`, `https://www.youtube.com.evil.example/watch?v=${ID}`,
  `https://vimeo.com/${ID}`, `javascript:alert(1)//youtu.be/${ID}`, `https://youtu.be/${ID}extra`,
]) assert.equal(R.youtubeIdFrom(bad), null, String(bad));

assert.equal(R.youtubeEmbedUrl(ID), `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0`);

// örnekler: tarih sırası (yeniden eskiye), adet/sipariş bilgisi yok, video kimliği bağlantıyla tutarlı
const f = R.SITE_RELEASE_FIXTURES;
assert.ok(f.length >= 3);
assert.deepEqual([...f].sort((a, b) => b.releasedOn.localeCompare(a.releasedOn)), f, "örnekler yeniden eskiye sıralı");
for (const r of f) {
  assert.deepEqual(Object.keys(r).sort(), ["id", "releasedOn", "reportUrl", "seasonLabel", "title", "video"], "sözleşmede adet/sipariş alanı olmamalı");
  if (r.video) assert.equal(R.youtubeIdFrom(r.video.url), r.video.youtubeId);
}
assert.ok(f.some((r) => r.video === null) && f.some((r) => r.title === null) && f.some((r) => r.reportUrl), "örnekler üç durumu da kapsamalı");

console.log("✓ site-releases: YouTube kimliği çözümleme, gömme adresi, örnek kayıtlar");
