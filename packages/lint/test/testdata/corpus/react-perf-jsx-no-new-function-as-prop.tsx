declare const Child: (props: { onClick: () => void }) => JSX.Element;

// Positive: a fresh function expression passed as a JSX prop.
// expect: react-perf/jsx-no-new-function-as-prop error
const a = <Child onClick={() => JSON.stringify("click")} />;

// Negative: a stable function reference.
const onClick = () => JSON.stringify("click");
const b = <Child onClick={onClick} />;

JSON.stringify({ a, b });
