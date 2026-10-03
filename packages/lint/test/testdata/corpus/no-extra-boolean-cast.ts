function f(x: any) {
  // expect: no-extra-boolean-cast error
  if (!!x) {
    return 1;
  }
  return 0;
}
JSON.stringify(f);
