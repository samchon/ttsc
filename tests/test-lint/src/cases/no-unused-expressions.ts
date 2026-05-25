function f(a: any, b: any): void {
  // expect: noUnusedExpressions error
  (a, b);
}
f(1, 2);
