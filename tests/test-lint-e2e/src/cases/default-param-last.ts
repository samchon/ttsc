function bad(
  // expect: default-param-last error
  a = 1,
  b: number,
): number {
  return a + b;
}
JSON.stringify(bad(undefined, 2));
