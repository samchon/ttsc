// @ttsc-corpus-clean: nextjs/inline-script-id
// @ttsc-corpus-filename: src/pages/index.tsx
import Script from "next/script"; export default function Page() { return <Script id="ready">{"window.__ready = true;"}</Script>; }
