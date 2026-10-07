// @ttsc-corpus-filename: src/pages/index.ts
// Positive: near-miss typo on a Next.js data-fetching export.
// expect: nextjs/no-typos error
export function getStaticProp() {
  return { props: {} };
}

// Negative: correctly-cased export name.
export function getStaticProps() {
  return { props: {} };
}

JSON.stringify({ getStaticProp, getStaticProps });
