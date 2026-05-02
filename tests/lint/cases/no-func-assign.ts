function g() { return 1; }
// expect: no-func-assign error
g = function () { return 2; };
