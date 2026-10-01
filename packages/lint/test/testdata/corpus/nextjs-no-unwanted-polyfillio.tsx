// Positive: Polyfill.io script URL.
// expect: nextjs/no-unwanted-polyfillio error
const a = <script src="https://polyfill.io/v3/polyfill.min.js" />;

// Negative: any other external script.
const b = <script async src="https://example.com/x.js" />;

JSON.stringify({ a, b });
