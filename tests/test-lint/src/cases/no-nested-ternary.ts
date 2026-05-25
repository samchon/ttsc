function f(a: any, b: any, c: any, d: any, e: any) {
  // expect: no-nested-ternary error
  return a ? b : c ? d : e;
}
JSON.stringify(f);
