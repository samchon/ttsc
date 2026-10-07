// @ttsc-corpus-filename: src/pages/index.tsx

export default function Page() {
  return (
    <>
      // expect: nextjs/no-unwanted-polyfillio error
      <script src="https://polyfill.io/v3/polyfill.min.js?features=Array.prototype.includes" />
    </>
  );
}
