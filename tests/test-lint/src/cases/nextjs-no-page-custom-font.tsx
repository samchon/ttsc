// @ttsc-corpus-filename: src/pages/index.tsx
// Positive: Google Fonts `<link>` inside a regular pages file.
const a = (
  // expect: nextjs/no-page-custom-font error
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Inter&display=swap"
  />
);

// Negative: same link declared in `pages/_document.tsx`.
const b = null;

JSON.stringify({ a, b });
