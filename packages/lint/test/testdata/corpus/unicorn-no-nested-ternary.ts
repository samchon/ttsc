declare const x: number;
// expect: unicorn/no-nested-ternary error
const r = x === 0 ? "zero" : x > 0 ? "pos" : "neg";
JSON.stringify(r);
