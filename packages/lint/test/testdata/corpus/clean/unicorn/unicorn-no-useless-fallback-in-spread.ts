// @ttsc-corpus-clean: unicorn/no-useless-fallback-in-spread
declare const x: { a: number } | null; const o = { ...x };
