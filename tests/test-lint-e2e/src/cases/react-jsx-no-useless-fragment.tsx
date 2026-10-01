declare const Child: () => JSX.Element;
declare const React: { Fragment: unknown };

// Positive: short fragment with a single element child.
const a = (
  // expect: react/jsx-no-useless-fragment error
  <>
    <Child />
  </>
);

// Positive: explicit `<Fragment>` wrapping one element.
const b = (
  // expect: react/jsx-no-useless-fragment error
  <Fragment>
    <Child />
  </Fragment>
);

// Positive: qualified `<React.Fragment>` with no meaningful children.
const c = (
  // expect: react/jsx-no-useless-fragment error
  <React.Fragment></React.Fragment>
);

// Positive: short fragment with nothing inside (whitespace only).
const d = (
  // expect: react/jsx-no-useless-fragment error
  <>   </>
);

// Negative: fragment with multiple element children — the wrapping is needed.
const e = (
  <>
    <Child />
    <Child />
  </>
);

// Negative: fragment with text content alongside an element — keep it.
const f = (
  <>
    hello
    <Child />
  </>
);

// Negative: fragment whose only child is bare text — also kept.
const g = <>hello</>;

JSON.stringify({ a, b, c, d, e, f, g });
