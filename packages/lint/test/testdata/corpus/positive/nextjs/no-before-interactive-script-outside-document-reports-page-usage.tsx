// @ttsc-corpus-filename: src/pages/index.tsx

import Script from "next/script";

export default function Page() {
  return (
    <>
      // expect: nextjs/no-before-interactive-script-outside-document error
      <Script strategy="beforeInteractive" src="/early.js" />
    </>
  );
}
