// @ttsc-corpus-filename: src/pages/_document.tsx

// expect: nextjs/no-head-import-in-document error
import Head from "next/head";

export default function Document() {
  return <Head />;
}
