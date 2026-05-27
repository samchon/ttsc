declare const a: number;
declare const b: number;
// expect: unicorn/prefer-math-min-max error
const m = a < b ? a : b;
void m;
