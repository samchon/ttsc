// expect: no-empty-object-type error
type T = {};
const v: T = {};
JSON.stringify(v);