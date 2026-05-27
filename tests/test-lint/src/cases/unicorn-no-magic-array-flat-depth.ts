// expect: unicorn/no-magic-array-flat-depth error
const flat = [1, [2, [3]]].flat(2);
void flat;
