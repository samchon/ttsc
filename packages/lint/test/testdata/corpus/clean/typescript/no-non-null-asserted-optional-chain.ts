// @ttsc-corpus-clean: typescript/no-non-null-asserted-optional-chain
declare const o: { a?: { b: number } };
const x = o?.a;
