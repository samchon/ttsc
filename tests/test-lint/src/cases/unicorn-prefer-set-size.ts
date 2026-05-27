declare const s: Set<number>;
// expect: unicorn/prefer-set-size error
const n = [...s].length;
