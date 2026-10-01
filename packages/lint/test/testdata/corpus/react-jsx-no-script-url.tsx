// Positive: `javascript:` URL passed to a JSX href.
// expect: react/jsx-no-script-url error
const a = <a href="javascript:void(0)">click</a>;

// Negative: normal absolute URL.
const b = <a href="https://example.com">click</a>;

JSON.stringify({ a, b });
