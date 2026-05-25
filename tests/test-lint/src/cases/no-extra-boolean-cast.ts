function f(x: any) {
  // expect: noExtraBooleanCast error
  if (!!x) {
    return 1;
  }
  return 0;
}
JSON.stringify(f);
