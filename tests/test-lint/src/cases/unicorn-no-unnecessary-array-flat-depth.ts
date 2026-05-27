// expect: unicorn/no-unnecessary-array-flat-depth error
const flat = [1, [2]].flat(1);
void flat;
