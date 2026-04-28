const x = 1;
// expect: object-shorthand error
const o = { x: x };
JSON.stringify(o);