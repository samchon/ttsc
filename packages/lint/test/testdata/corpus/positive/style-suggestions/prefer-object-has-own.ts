declare const target: { x: number };
// expect: prefer-object-has-own error
const a = Object.prototype.hasOwnProperty.call(target, "x");
JSON.stringify(a);
