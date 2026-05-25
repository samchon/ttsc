declare const input: unknown;

// expect: consistent-type-assertions error
const value = <string>input;
JSON.stringify(value);
