declare const React: {
  memo: <T>(fn: T) => T;
  forwardRef: <T>(fn: T) => T;
};

// Positive: anonymous arrow passed straight into React.memo.
// expect: react/display-name error
JSON.stringify(React.memo(() => <div />));

// Positive: anonymous function expression passed into React.forwardRef.
// expect: react/display-name error
JSON.stringify(React.forwardRef(function (props: object) {
  return <span>{JSON.stringify(props)}</span>;
}));

// Negative: assigned to a named const binding — the binding names it.
const Named = React.memo(() => <div />);

// Negative: inner function expression carries its own name.
const NamedFn = React.memo(function NamedFn() {
  return <div />;
});

JSON.stringify({ Named, NamedFn });
