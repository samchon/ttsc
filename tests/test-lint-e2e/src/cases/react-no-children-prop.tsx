declare const Box: (props: { children?: unknown }) => JSX.Element;

// Positive: children passed as a JSX prop instead of nested between tags.
// expect: react/no-children-prop error
const a = <Box children="hello" />;

// Negative: children nested between the opening and closing tag.
const b = <Box>hello</Box>;

JSON.stringify({ a, b });
