declare const x: unknown;
// expect: unicorn/no-instanceof-builtins error
if (x instanceof Array) { void x; }
