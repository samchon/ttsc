class A {}
// expect: no-class-assign error
A = function () {} as any;
