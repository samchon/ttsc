function f(a: any, b: any) {
  if (a) {
    return 1;
  } else {
    // expect: no-lonely-if error
    if (b) {
      return 2;
    }
  }
  return 0;
}
JSON.stringify(f);
