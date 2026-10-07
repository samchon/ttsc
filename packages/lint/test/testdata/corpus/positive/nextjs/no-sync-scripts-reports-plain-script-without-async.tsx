// @ttsc-corpus-filename: src/pages/index.tsx

export default function Page() {
  return (
    <>
      // expect: nextjs/no-sync-scripts error
      <script src="/legacy.js" />
    </>
  );
}
