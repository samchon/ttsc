// expect: unicorn/no-unreadable-array-destructuring error
const [, , , , a] = [1, 2, 3, 4, 5];
void a;
