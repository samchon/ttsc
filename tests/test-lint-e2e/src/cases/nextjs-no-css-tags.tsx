// Positive: raw `<link rel="stylesheet">` tag.
// expect: nextjs/no-css-tags error
const a = <link rel="stylesheet" href="/styles.css" />;

// Negative: a stylesheet imported through the Next.js build system.
const b = null;

JSON.stringify({ a, b });
