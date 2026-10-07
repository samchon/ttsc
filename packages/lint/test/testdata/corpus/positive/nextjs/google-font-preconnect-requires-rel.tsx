// @ttsc-corpus-filename: src/pages/index.tsx

export default function Page() {
  return (
    <>
      // expect: nextjs/google-font-preconnect error
      <link href="https://fonts.gstatic.com" />
    </>
  );
}
