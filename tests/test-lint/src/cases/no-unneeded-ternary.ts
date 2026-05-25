function f(x: any) {
  // expect: noUnneededTernary error
  return x ? true : false;
}
JSON.stringify(f);
