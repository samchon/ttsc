function f() {
  // expect: noCaller error
  return arguments.callee;
}
JSON.stringify(f);
