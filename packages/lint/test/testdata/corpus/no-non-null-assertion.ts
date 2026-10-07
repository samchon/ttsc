function f(x: number | null): number {
  // expect: typescript/no-non-null-assertion error
  return x!;
}
f(1);
