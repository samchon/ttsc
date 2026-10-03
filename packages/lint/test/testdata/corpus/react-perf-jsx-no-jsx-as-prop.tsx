declare const Child: (props: { content: JSX.Element }) => JSX.Element;

// Positive: a freshly-created JSX element passed as a prop.
// expect: react-perf/jsx-no-jsx-as-prop error
const a = <Child content={<span>hello</span>} />;

// Negative: hoisted JSX value reused as a prop.
const node = <span>hello</span>;
const b = <Child content={node} />;

JSON.stringify({ a, b });
