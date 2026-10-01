// @ttsc-corpus-clean: unicorn/consistent-empty-array-spread
declare const cond: boolean; declare const x: number; const a = [1, ...(cond ? [x] : [])];
