declare const ready: boolean;
declare function check(): boolean;

if (
  check() &&
  // expect: unicorn/prefer-simple-condition-first error
  ready
) {
  void 0;
}

if (ready && check()) {
  void 0;
}
