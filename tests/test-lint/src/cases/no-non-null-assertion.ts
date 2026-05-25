function f(x: number | null): number {
  // expect: no-non-null-assertion error
  return x!;
}
f(1);
