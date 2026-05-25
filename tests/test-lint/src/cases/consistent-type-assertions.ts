declare const input: unknown;

// expect: consistentTypeAssertions error
const value = <string>input;
JSON.stringify(value);
