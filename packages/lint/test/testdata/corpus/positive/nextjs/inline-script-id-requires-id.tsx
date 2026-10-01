// @ttsc-corpus-filename: src/pages/index.tsx

import Script from "next/script";

export default function Page() {
  return (
    <>
      // expect: nextjs/inline-script-id error
      <Script>{`window.__ready = true;`}</Script>
    </>
  );
}
