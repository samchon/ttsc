function f(
  // expect: noExplicitAny error
  x: any,
): number {
  return Number(x);
}
f(0);
