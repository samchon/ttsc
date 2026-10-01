declare const x: number | undefined;
// expect: unicorn/prefer-logical-operator-over-ternary error
const y = x ? x : 0;
void y;
