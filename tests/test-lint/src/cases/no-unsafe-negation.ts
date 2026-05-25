function f(a: any, b: any) {
  // expect: no-unsafe-negation error
  // @ts-ignore
  return !a in b;
}
JSON.stringify(f);
