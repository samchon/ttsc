// @ttsc-corpus-clean: nextjs/no-script-component-in-head
// @ttsc-corpus-filename: src/pages/index.tsx
import Head from "next/head"; import Script from "next/script"; export default function Page() { return <><Head /><Script src="/head.js" /></>; }
