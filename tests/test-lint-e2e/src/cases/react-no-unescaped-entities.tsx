// Positive: raw double-quote in JSX text.
// expect: react/no-unescaped-entities error
const a = <p>She said "hello"</p>;

// Negative: HTML-entity-encoded equivalent.
const b = <p>She said &quot;hello&quot;</p>;

JSON.stringify({ a, b });
