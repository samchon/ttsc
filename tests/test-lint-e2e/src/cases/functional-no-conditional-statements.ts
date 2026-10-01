declare const flag: boolean;

// expect: functional/no-conditional-statements error
if (flag) {
  JSON.stringify("on");
}
