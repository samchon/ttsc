function f(x: any) {
  // expect: no-unneeded-ternary error
  return x ? true : false;
}
JSON.stringify(f);
