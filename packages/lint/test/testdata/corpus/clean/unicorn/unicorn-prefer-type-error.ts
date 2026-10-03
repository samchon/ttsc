// @ttsc-corpus-clean: unicorn/prefer-type-error
function f(x: unknown) { if (typeof x !== "number") { throw new TypeError("must be number"); } return x; }
