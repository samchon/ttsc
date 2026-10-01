// expect: unicorn/no-immediate-mutation error
const last = [1, 2, 3].push(4);
void last;
