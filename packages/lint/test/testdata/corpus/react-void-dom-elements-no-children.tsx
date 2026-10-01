// Positive: `<img>` with text children.
// expect: react/void-dom-elements-no-children error
const a = <img src="/x">caption</img>;

// Negative: void element with no children.
const b = <img src="/x" />;

JSON.stringify({ a, b });
