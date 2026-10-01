declare const Child: (props: { style: object }) => JSX.Element;

// Positive: a fresh object literal passed as a JSX prop.
// expect: react-perf/jsx-no-new-object-as-prop error
const a = <Child style={{ color: "red" }} />;

// Negative: a stable object reference.
const style = { color: "red" };
const b = <Child style={style} />;

JSON.stringify({ a, b });
