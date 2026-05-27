// @ttsc-corpus-skip: rule fires only on files whose path contains `/pages/`; the flat corpus runner writes every fixture to `src/main.ts`. Go corpus coverage lives at packages/lint/test/rules/nextjs/no_typos_reports_misspelled_data_export_test.go.
// Positive: near-miss typo on a Next.js data-fetching export.
// expect: nextjs/no-typos error
export function getstaticprops() {
  return { props: {} };
}

// Negative: correctly-cased export name.
export function getStaticProps() {
  return { props: {} };
}

JSON.stringify({ getstaticprops, getStaticProps });
