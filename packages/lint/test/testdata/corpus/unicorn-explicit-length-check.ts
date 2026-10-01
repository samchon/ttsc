declare const xs: number[];
if (
  // expect: unicorn/explicit-length-check error
  xs.length
) {
  void 0;
}
