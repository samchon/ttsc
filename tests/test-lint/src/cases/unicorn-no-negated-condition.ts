declare const x: number;
// expect: unicorn/no-negated-condition error
if (x !== 0) {
  void "nonzero";
} else {
  void "zero";
}
