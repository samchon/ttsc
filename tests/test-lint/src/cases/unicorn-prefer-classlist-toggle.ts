declare const el: Element;
declare const cond: boolean;
// expect: unicorn/prefer-classlist-toggle error
if (cond) {
  el.classList.add("active");
} else {
  el.classList.remove("active");
}
