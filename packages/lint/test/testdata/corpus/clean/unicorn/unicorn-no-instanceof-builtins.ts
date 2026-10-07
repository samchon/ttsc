// @ttsc-corpus-clean: unicorn/no-instanceof-builtins
declare const x: unknown; if (Array.isArray(x)) { void x; }
