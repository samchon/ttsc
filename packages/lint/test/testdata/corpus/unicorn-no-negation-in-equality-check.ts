declare const a: number;
declare const b: number;
// expect: unicorn/no-negation-in-equality-check error
const eq = !a === b;
void eq;
