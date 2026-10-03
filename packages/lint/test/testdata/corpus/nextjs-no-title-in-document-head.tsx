// @ttsc-corpus-filename: src/pages/_document.tsx
import { Head } from "next/document";

// Positive: `<title>` inside `Head` from `next/document`.
const a = (
  <Head>
    {/* expect: nextjs/no-title-in-document-head error */}
    <title>Site</title>
  </Head>
);

// Negative: no title inside Head.
const b = <Head />;

JSON.stringify({ a, b });
