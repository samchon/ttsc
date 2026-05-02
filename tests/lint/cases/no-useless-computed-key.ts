// expect: no-useless-computed-key error
const o = { ["foo"]: 1 };
JSON.stringify(o);