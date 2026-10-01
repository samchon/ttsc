const items = ["a", "b", "c"];

// Positive: using the map index as a JSX `key`.
// expect: react/no-array-index-key error
const a = items.map((value, index) => <li key={index}>{value}</li>);

// Negative: keying on a stable identifier.
const b = items.map((value) => <li key={value}>{value}</li>);

JSON.stringify({ a, b });
