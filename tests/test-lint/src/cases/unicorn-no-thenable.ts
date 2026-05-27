const o = {
  // expect: unicorn/no-thenable error
  then() {
    return 1;
  },
};
void o;
