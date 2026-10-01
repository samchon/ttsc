// expect: promise/prefer-await-to-callbacks error
function load(callback: () => void) {
  void callback;
}
