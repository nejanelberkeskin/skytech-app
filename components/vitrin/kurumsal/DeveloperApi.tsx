"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useTranslations } from "next-intl";
import SectionHeading from "../SectionHeading";

type SampleKey = "install" | "cart" | "certificate" | "webhook";

export default function DeveloperApi() {
  const t = useTranslations("corporatePage.api");
  const [activeKey, setActiveKey] = useState<SampleKey>("cart");
  const [copied, setCopied] = useState(false);

  const SAMPLES: Record<SampleKey, { label: string; lang: string; code: string }> = {
    install: {
      label: t("samples.install.label"),
      lang: "bash",
      code: `npm install @skytechgreen/sdk`,
    },
    cart: {
      label: t("samples.cart.label"),
      lang: "javascript",
      code: `import { addSeedToCart } from "@skytechgreen/sdk";

// ${t("samples.cart.comment")}
await addSeedToCart({
  cartId: order.id,
  quantity: 1,
  giftMessage: "${t("samples.cart.giftMessage")}",
});`,
    },
    certificate: {
      label: t("samples.certificate.label"),
      lang: "javascript",
      code: `import { issueCertificate } from "@skytechgreen/sdk";

// ${t("samples.certificate.comment")}
const cert = await issueCertificate({
  recipientName: "Ali Yılmaz",
  trees: 50,
  forestName: "Çanakkale Kurumsal Ormanı",
  language: "tr",
});

// ${t("samples.certificate.commentUrl")}`,
    },
    webhook: {
      label: t("samples.webhook.label"),
      lang: "javascript",
      code: `// ${t("samples.webhook.comment")}
app.post("/skytech/webhook", (req, res) => {
  const { event, payload } = req.body;
  if (event === "flight.completed") {
    // ${t("samples.webhook.commentProcess")}
    pushToESG({
      ton: payload.co2Tonneutralized,
      gpsCoords: payload.coordinates,
      videoUrl: payload.droneFootageUrl,
    });
  }
  res.sendStatus(200);
});`,
    },
  };

  const sample = SAMPLES[activeKey];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sample.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  };

  return (
    <section className="relative overflow-hidden vitrin-section mesh-dark grain-overlay">
      <div className="aurora-bg">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
      </div>

      <div className="relative vitrin-container">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full premium-glass-dark mb-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#a7d4a7]"
          >
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-[#34d399] opacity-75 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-[#34d399]" />
            </span>
            {t("badge")}
            <span className="px-2 py-0.5 ml-1 rounded-full bg-[#a3e635]/20 border border-[#a3e635]/30 text-[#a3e635] text-[9px]">
              {t("comingSoon")}
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="display-headline text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-5"
          >
            {t("title.pre")}{" "}
            <span className="text-gradient-aurora">{t("title.highlight")}</span>
            <br />
            {t("title.post")}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.25 }}
            className="text-base lg:text-lg text-[#a7d4a7] leading-relaxed"
          >
            {t("intro")}
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mx-auto"
        >
          {/* Tab pills */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {(Object.keys(SAMPLES) as SampleKey[]).map((key) => {
              const isActive = key === activeKey;
              return (
                <button
                  key={key}
                  onClick={() => setActiveKey(key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                    isActive
                      ? "bg-[#22894a] text-white shadow-lg shadow-[#22894a]/25"
                      : "bg-white/5 border border-white/10 text-[#a7d4a7] hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {SAMPLES[key].label}
                </button>
              );
            })}
          </div>

          {/* Code block */}
          <div className="relative rounded-2xl overflow-hidden premium-glass-dark border border-white/10">
            {/* Terminal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 bg-black/30">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <span className="w-3 h-3 rounded-full bg-[#28ca42]" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#6b8f6b] font-bold font-mono">
                {sample.lang}
              </span>
              <button
                onClick={handleCopy}
                className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#a7d4a7] hover:text-white inline-flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-[#34d399]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t("copied")}
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                    </svg>
                    {t("copy")}
                  </>
                )}
              </button>
            </div>

            {/* Code */}
            <pre className="overflow-x-auto p-5 lg:p-6 text-sm leading-[1.7] font-mono">
              <code className="text-[#e0f0e0]">{highlightCode(sample.code, sample.lang)}</code>
            </pre>
          </div>

          {/* Footer hint */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 text-xs">
            <p className="text-[#6b8f6b]">
              <span className="text-[#a7d4a7]">$ </span>
              <span className="font-mono">curl -X POST https://api.skytechgreen.com/v1/seeds</span>
            </p>
            <a
              href="/iletisim"
              className="inline-flex items-center gap-1.5 text-[#a3e635] font-bold hover:text-[#34d399]"
            >
              {t("earlyAccess")}
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* Tiny syntax highlighter for our two demo languages.
   Not a full parser — just regex-based span colorization for the demo. */
function highlightCode(src: string, lang: string): React.ReactNode {
  const tokens: { color: string; text: string }[] = [];

  if (lang === "bash") {
    tokens.push({ color: "#34d399", text: src });
  } else {
    // very small JS tokenizer
    const re = /(\/\/[^\n]*|"[^"\n]*"|'[^'\n]*'|`[^`]*`|\b(?:import|from|await|async|const|let|var|function|return|if|else|new|export|default)\b|\b(?:true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b|[a-zA-Z_$][\w$]*|\s+|[^\w\s])/g;
    const keywords = new Set([
      "import", "from", "await", "async", "const", "let", "var",
      "function", "return", "if", "else", "new", "export", "default",
    ]);
    const literals = new Set(["true", "false", "null", "undefined"]);
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const t = m[0];
      let color = "#e0f0e0";
      if (/^\/\//.test(t)) color = "#6b8f6b";
      else if (/^["'`]/.test(t)) color = "#a3e635";
      else if (keywords.has(t)) color = "#7dd3fc";
      else if (literals.has(t)) color = "#fcd34d";
      else if (/^\d/.test(t)) color = "#fcd34d";
      else if (/^[A-Z]/.test(t)) color = "#fda4af";
      else if (/^[a-z_$][\w$]*$/.test(t) && src[re.lastIndex] === "(") color = "#34d399";
      tokens.push({ color, text: t });
    }
  }

  return tokens.map((t, i) => (
    <span key={i} style={{ color: t.color }}>
      {t.text}
    </span>
  ));
}
