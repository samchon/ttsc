declare const url: string;

// Positive: iframe with no sandbox attribute.
// expect: react/iframe-missing-sandbox error
const a = <iframe src={url} />;

// Negative: iframe with an explicit sandbox attribute.
const b = <iframe src={url} sandbox="allow-scripts" />;

JSON.stringify({ a, b });
