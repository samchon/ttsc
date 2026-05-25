function f(x: number | null): number {
  // expect: noNonNullAssertion error
  return x!;
}
f(1);
