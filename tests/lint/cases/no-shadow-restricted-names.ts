// expect: no-shadow-restricted-names error
function f(undefined: number) { return undefined; }
f(1);
