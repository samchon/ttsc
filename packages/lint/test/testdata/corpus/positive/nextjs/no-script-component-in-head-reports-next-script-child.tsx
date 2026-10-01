// @ttsc-corpus-filename: src/pages/index.tsx

import Head from "next/head";
import Script from "next/script";

export default function Page() {
  return (
    <Head>
      // expect: nextjs/no-script-component-in-head error
      <Script src="/head.js" />
    </Head>
  );
}
