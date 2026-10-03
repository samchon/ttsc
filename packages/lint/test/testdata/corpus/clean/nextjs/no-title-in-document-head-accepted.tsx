// @ttsc-corpus-clean: nextjs/no-title-in-document-head
// @ttsc-corpus-filename: src/pages/_document.tsx
import { Head } from "next/document"; export default function Document() { return <Head><meta charSet="utf-8" /></Head>; }
