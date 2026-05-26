function f(x: number | null, y: number) {
  // expect: typescript/no-confusing-non-null-assertion error
  return x! === y;
}
JSON.stringify(f);
