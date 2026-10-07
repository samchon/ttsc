// @ttsc-corpus-clean: nextjs/no-before-interactive-script-outside-document
// @ttsc-corpus-filename: src/pages/_document.tsx
import Script from "next/script"; export default function Document() { return <Script strategy="beforeInteractive" src="/early.js" />; }
