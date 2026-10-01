const original = new Date();
// expect: unicorn/consistent-date-clone error
const clone = new Date(original.getTime());
void clone;
