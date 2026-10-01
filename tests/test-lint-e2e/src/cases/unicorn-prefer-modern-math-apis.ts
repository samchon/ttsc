declare const x: number;
// expect: unicorn/prefer-modern-math-apis error
const l = Math.log(x) * Math.LOG10E;
void l;
