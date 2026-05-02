function f(a: any) {
  // expect: no-return-assign error
  return a = 1;
}
JSON.stringify(f);