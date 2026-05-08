function f(x: number | null) {
  // expect: no-extra-non-null-assertion error
  return x!!;
}
JSON.stringify(f);
