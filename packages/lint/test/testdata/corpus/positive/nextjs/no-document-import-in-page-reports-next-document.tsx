// @ttsc-corpus-filename: src/pages/index.tsx

// expect: nextjs/no-document-import-in-page error
import Document from "next/document";

export default function Page() {
  return <main />;
}
