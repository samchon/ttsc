// @ttsc-corpus-filename: src/pages/index.tsx

export default function Page() {
  return (
    <>
      // expect: nextjs/next-script-for-ga error
      <script src="https://www.google-analytics.com/analytics.js" />
      <script src="https://cdn.example.com/application.js" />
    </>
  );
}
