// @ttsc-corpus-filename: src/pages/_document.tsx

import { Head } from "next/document";

export default function Document() {
  return (
    <Head>
      // expect: nextjs/no-title-in-document-head error
      <title>Bad</title>
    </Head>
  );
}
