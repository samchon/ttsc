function f(x: number) {
  switch (x) {
    case 1:
      return "a";
    // expect: no-duplicate-case error
    case 1:
      return "b";
  }
  return "";
}
JSON.stringify(f);
