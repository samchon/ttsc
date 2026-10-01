// @ttsc-corpus-filename: src/pages/index.tsx

export default function Page() {
  return (
    <>
      // expect: nextjs/google-font-display error
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />
    </>
  );
}
