function f(a: any, b: any) {
  // expect: noUnsafeNegation error
  // @ts-ignore
  return !a in b;
}
JSON.stringify(f);
