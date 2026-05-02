function f(a: any, b: any) {
  // expect: no-unsafe-negation error
  return (!a) in b;
}
JSON.stringify(f);
