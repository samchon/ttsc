function f() {}
// expect: no-useless-call error
f.call(undefined, 1);
