function f(x: number) {
  switch (x) {
    case 1:
      return "a";
    // expect: noDuplicateCase error
    case 1:
      return "b";
  }
  return "";
}
JSON.stringify(f);
