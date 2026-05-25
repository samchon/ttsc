function f(x: any) {
  // expect: validTypeof error
  return typeof x === "stirng";
}
JSON.stringify(f);
