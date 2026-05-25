function f(a: any, b: any) {
  // expect: noSequences error
  return a++, b;
}
JSON.stringify(f);
