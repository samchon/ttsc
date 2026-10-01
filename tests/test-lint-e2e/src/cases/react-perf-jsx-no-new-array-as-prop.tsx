declare const Child: (props: { items: number[] }) => JSX.Element;

// Positive: a fresh array literal passed as a JSX prop.
// expect: react-perf/jsx-no-new-array-as-prop error
const a = <Child items={[1, 2, 3]} />;

// Negative: a stable array reference.
const items = [1, 2, 3];
const b = <Child items={items} />;

JSON.stringify({ a, b });
