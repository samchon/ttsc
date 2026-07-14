declare const key: string;
switch (key) {
  case "first": {
    void key;
  }
  // expect: unicorn/switch-case-break-position error
  break;
}
