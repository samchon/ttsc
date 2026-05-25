function f() {}
// expect: noUselessCall error
f.call(undefined, 1);
