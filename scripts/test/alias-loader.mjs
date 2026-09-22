// Testler için çözümleyici: "@/…" takma adı ve uzantısız göreli içe aktarmalar (.ts/.tsx).
// Node'un yerleşik tür ayıklamasıyla lib/ altındaki saf modüller derleme gerektirmeden sınanır.
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const EXTS = [".ts", ".tsx", "/index.ts"];

const tryFile = (base) => {
  for (const ext of EXTS) if (fs.existsSync(base + ext)) return pathToFileURL(base + ext).href;
  return null;
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    // "@/…" takma adı
    if (specifier.startsWith("@/")) {
      const hit = tryFile(ROOT + "/" + specifier.slice(2));
      if (hit) return nextResolve(hit, context);
    }
    // uzantısız göreli içe aktarma ("./slug")
    if (/^\.\.?\//.test(specifier) && !path.extname(specifier) && context.parentURL?.startsWith("file:")) {
      const hit = tryFile(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
      if (hit) return nextResolve(hit, context);
    }
    return nextResolve(specifier, context);
  },
});
