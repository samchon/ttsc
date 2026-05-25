function f(a: any) {
  // expect: noReturnAssign error
  return (a = 1);
}
JSON.stringify(f);
