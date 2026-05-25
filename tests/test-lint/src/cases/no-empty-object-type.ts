// expect: noEmptyObjectType error
type T = {};
const v: T = {};
JSON.stringify(v);
