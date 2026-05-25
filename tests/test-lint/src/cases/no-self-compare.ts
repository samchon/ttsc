function f(a: number) {
  // expect: noSelfCompare error
  return a === a;
}
JSON.stringify(f);
