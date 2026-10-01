// Positive: bare `<a>` linking to an internal page.
// expect: nextjs/no-html-link-for-pages error
const a = <a href="/about">about</a>;

// Negative: same target through `next/link`.
const b = null;

JSON.stringify({ a, b });
