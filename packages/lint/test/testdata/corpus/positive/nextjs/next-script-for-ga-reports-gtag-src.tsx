// @ttsc-corpus-filename: src/pages/index.tsx

import Script from "next/script";

export default function Page() {
  return (
    <>
      // expect: nextjs/next-script-for-ga error
      <script src="https://www.googletagmanager.com/gtag/js?id=G-1" />
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-1" />
    </>
  );
}
