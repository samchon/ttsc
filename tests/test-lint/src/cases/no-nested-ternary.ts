function f(a: any, b: any, c: any, d: any, e: any) {
  // expect: noNestedTernary error
  return a ? b : c ? d : e;
}
JSON.stringify(f);
