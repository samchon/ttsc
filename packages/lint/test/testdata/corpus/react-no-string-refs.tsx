// Positive: string ref.
// expect: react/no-string-refs error
const a = <input ref="name" />;

// Negative: callback ref.
const b = <input ref={(el) => JSON.stringify(el)} />;

JSON.stringify({ a, b });
