function f(x: number | null) {
  // expect: typescript/no-extra-non-null-assertion error
  return x!!;
}
JSON.stringify(f);
