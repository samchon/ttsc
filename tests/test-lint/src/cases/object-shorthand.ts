const x = 1;
// expect: objectShorthand error
const o = { x: x };
JSON.stringify(o);
