const original = { a: 1 };
// expect: unicorn/prefer-structured-clone error
const clone = JSON.parse(JSON.stringify(original));
