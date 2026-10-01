// @ttsc-corpus-filename: src/pages/index.tsx

export default function Page() {
  return (
    <>
      // expect: nextjs/next-script-for-ga error
      <script dangerouslySetInnerHTML={{ __html: `https://www.googletagmanager.com/gtm.js?id=GTM-1` }} />
      <script dangerouslySetInnerHTML={{ __html: `https://cdn.example.com/loader.js` }} />
    </>
  );
}
