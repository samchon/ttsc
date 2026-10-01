// @ttsc-corpus-clean: unicorn/no-negated-condition
declare const x: number; if (x === 0) { void "zero"; } else { void "nonzero"; }
