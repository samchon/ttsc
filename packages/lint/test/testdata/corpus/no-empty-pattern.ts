// expect: no-empty-pattern error
function f({}: { a?: number }): void {}
f({ a: 1 });
