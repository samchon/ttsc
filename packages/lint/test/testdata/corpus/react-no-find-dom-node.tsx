declare const ReactDOM: { findDOMNode: (component: unknown) => unknown };
declare const component: unknown;

// Positive: `findDOMNode` call.
// expect: react/no-find-dom-node error
const a = ReactDOM.findDOMNode(component);

// Negative: avoid the API entirely.
const b = component;

JSON.stringify({ a, b });
