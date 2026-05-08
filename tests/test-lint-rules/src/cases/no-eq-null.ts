function f(x: any) {
  // expect: no-eq-null error
  return x == null;
}
JSON.stringify(f);
