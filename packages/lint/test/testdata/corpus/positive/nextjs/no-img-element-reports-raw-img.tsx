// @ttsc-corpus-filename: src/pages/index.tsx

export default function Page() {
  // expect: nextjs/no-img-element error
  return <img src="/logo.png" alt="Logo" />;
}
