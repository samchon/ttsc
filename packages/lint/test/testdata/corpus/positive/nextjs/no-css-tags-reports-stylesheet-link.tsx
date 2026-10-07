// @ttsc-corpus-filename: src/pages/index.tsx

export default function Page() {
  return (
    <>
      // expect: nextjs/no-css-tags error
      <link rel="stylesheet" href="/main.css" />
    </>
  );
}
