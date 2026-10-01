// expect: unicorn/prefer-native-coercion-functions error
const xs = ["1", "2"].map((x) => Number(x));
void xs;
