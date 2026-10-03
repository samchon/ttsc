declare const value: unknown;
// expect: no-implicit-coercion error
const asBool = !!value;
JSON.stringify(asBool);
