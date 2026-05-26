declare const input: unknown;

// expect: typescript/consistent-type-assertions error
const value = <string>input;
JSON.stringify(value);
