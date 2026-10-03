declare function load(): Promise<string>;
// expect: unicorn/prefer-top-level-await error
load().then((s) => {
  void s;
});
