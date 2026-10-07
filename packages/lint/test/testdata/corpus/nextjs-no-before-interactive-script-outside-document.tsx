import Script from "next/script";

// Positive: `strategy="beforeInteractive"` used outside `pages/_document.tsx`.
// expect: nextjs/no-before-interactive-script-outside-document error
const a = <Script src="/x.js" strategy="beforeInteractive" />;

// Negative: same component using a different strategy.
const b = <Script src="/x.js" strategy="afterInteractive" />;

JSON.stringify({ a, b });
