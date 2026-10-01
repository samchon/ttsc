// @ttsc-corpus-filename: src/pages/_document.tsx
// Positive: `next/head` import inside `pages/_document.tsx`.
// expect: nextjs/no-head-import-in-document error
import Head from "next/head";

// Negative: importing from `next/document` instead.
import { Head as DocHead } from "next/document";

JSON.stringify({ Head, DocHead });
