function f(a: any) {
  // expect: noNegatedCondition error
  if (!a) {
    return 1;
  } else {
    return 2;
  }
}
JSON.stringify(f);
