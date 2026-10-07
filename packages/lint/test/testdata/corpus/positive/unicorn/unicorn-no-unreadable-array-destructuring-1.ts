// expect: unicorn/no-unreadable-array-destructuring error
const [, , a] = [1,2,3]; void a;
