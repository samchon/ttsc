const items = [1, 2, 3];

// Positive: array literal of JSX without keys.
// expect: react/jsx-key error
// expect: react/jsx-key error
const a = [<span>one</span>, <span>two</span>];

// Positive: `.map()` callback returning JSX without `key`.
// expect: react/jsx-key error
const b = items.map((n) => <span>{n}</span>);

// Negative: each child has an explicit key prop.
const c = items.map((n) => <span key={n}>{n}</span>);

JSON.stringify({ a, b, c });
