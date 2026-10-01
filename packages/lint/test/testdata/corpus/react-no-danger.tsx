declare const html: string;

// Positive: `dangerouslySetInnerHTML` prop.
// expect: react/no-danger error
const a = <div dangerouslySetInnerHTML={{ __html: html }} />;

// Negative: safe text rendering.
const b = <div>{html}</div>;

JSON.stringify({ a, b });
