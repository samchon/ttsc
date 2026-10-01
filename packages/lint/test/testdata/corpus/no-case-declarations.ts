function f(x: number) {
  switch (x) {
    case 1:
      // expect: no-case-declarations error
      let y = 1;
      return y;
  }
  return 0;
}
JSON.stringify(f);
