// Positive: string literal passed to JSX `style`.
// expect: react/style-prop-object error
const a = <div style="color: red" />;

// Negative: object literal passed to JSX `style`.
const b = <div style={{ color: "red" }} />;

JSON.stringify({ a, b });
