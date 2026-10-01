// @ttsc-corpus-clean: no-compare-neg-zero
function f(x: number) { return [x === 0, Object.is(x, -0)]; }
