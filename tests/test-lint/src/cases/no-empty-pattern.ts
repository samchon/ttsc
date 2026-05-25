// expect: noEmptyPattern error
function f({}: { a?: number }): void {}
f({ a: 1 });
