const arr = [1, 2, 3];
// expect: unicorn/no-unnecessary-slice-end error
const c = arr.slice(0, arr.length);
void c;
