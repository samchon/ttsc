// @ttsc-corpus-filename: src/pages/_document.tsx
import { Head } from "next/document";

// Positive: every `Head` after the first is a file-level duplicate.
export const documentHead = (
  <>
    <Head />
    {/* expect: nextjs/no-duplicate-head error */}
    <Head />
  </>
);
