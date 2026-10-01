function bad(
  // expect: default-param-last error
  a?: number,
  b: number,
): number {
  return (a ?? 0) + b;
}
function trailing(b: number, a?: number): number {
  return (a ?? 0) + b;
}
JSON.stringify(bad(undefined, 2));
