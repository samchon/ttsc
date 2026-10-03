// @ttsc-corpus-filename: src/pages/index.tsx
// Positive: importing `next/document` from a regular page file.
// expect: nextjs/no-document-import-in-page error
import Document from "next/document";

// Negative: a non-document import.
import Link from "next/link";

JSON.stringify({ Document, Link });
