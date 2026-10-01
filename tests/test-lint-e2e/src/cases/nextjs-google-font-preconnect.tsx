// Positive: `fonts.gstatic.com` link without `rel="preconnect"`.
// expect: nextjs/google-font-preconnect error
const a = <link href="https://fonts.gstatic.com" />;

// Negative: same href with `rel="preconnect"`.
const b = <link rel="preconnect" href="https://fonts.gstatic.com" />;

JSON.stringify({ a, b });
