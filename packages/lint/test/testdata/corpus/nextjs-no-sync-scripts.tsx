// Positive: external script tag without `async` or `defer`.
// expect: nextjs/no-sync-scripts error
const a = <script src="https://example.com/x.js" />;

// Negative: same script with `async`.
const b = <script async src="https://example.com/x.js" />;

JSON.stringify({ a, b });
