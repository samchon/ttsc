function f(a: any, b: any): void {
  // expect: no-unused-expressions error
  (a, b);
}
f(1, 2);
