// @ttsc-corpus-clean: typescript/no-non-null-assertion
function f(x: number | null): number { return x ?? 0; }
