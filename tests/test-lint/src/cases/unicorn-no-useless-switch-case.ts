declare const x: number;
switch (x) {
  case 1:
    void 0;
    break;
  // expect: unicorn/no-useless-switch-case error
  case 2:
  default:
    void 0;
}
