// @ttsc-corpus-clean: nextjs/no-head-import-in-document
// @ttsc-corpus-filename: src/pages/_document.tsx
import { Head } from "next/document"; export default function Document() { return <Head />; }
