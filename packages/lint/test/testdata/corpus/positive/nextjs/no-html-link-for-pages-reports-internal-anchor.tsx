// @ttsc-corpus-filename: src/pages/index.tsx

export default function Page() {
  // expect: nextjs/no-html-link-for-pages error
  return <a href="/about">About</a>;
}
