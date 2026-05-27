declare const s: string;
// expect: unicorn/prefer-string-starts-ends-with error
const b = s.slice(0, 4) === "http";
