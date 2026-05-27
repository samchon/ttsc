declare const Declared: () => JSX.Element;

// Positive: capitalized tag with no declaration anywhere in the file.
// expect: react/jsx-no-undef error
const a = <Missing />;

// Positive: capitalized tag inside a paired element, still undeclared.
// expect: react/jsx-no-undef error
const b = (
  <AlsoMissing>
    text
  </AlsoMissing>
);

// Negative: lowercase tags are intrinsic HTML.
const c = <div>hello</div>;

// Negative: capitalized tag with a matching declaration in the file.
const d = <Declared />;

// Negative: qualified `<Foo.Bar>` form — the rule skips qualified tags.
declare const Group: { Item: () => JSX.Element };
const e = <Group.Item />;

JSON.stringify({ a, b, c, d, e });
