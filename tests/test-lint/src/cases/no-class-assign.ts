class A {}
// expect: noClassAssign error
A = function () {} as any;
