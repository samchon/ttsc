const a = [1, 2, 3];
// expect: unicorn/prefer-negative-index error
const tail = a.slice(a.length - 1);
void tail;
