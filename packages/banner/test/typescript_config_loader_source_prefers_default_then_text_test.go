package banner_test

import (
  "strings"
  "testing"
)

// TestTypeScriptConfigLoaderSourcePrefersDefaultThenText verifies loader order.
//
// The TypeScript config loader emits a small module that resolves default
// interop wrappers at runtime. It must start from the module default export
// when present, then stop unwrapping once the current value is already a banner
// object.
//
// 1. Generate the TypeScript config loader source.
// 2. Locate default-export selection, the banner-object guard, and nested unwrap.
// 3. Assert the generated flow selects default first, then guards before unwrap.
func TestTypeScriptConfigLoaderSourcePrefersDefaultThenText(t *testing.T) {
  source := bannerTypeScriptConfigLoaderSource(`"./banner.config.ts"`)
  initial := strings.Index(source, `let current = isObject(value) && hasOwn(value, "default") ? value.default : value;`)
  guard := strings.Index(source, "isBannerObject(current)")
  nested := -1
  if guard >= 0 {
    nested = strings.Index(source[guard:], "current = current.default")
  }
  if initial < 0 || guard < 0 || nested < 0 || initial > guard {
    t.Fatalf("loader should select default, then guard before nested unwrap:\n%s", source)
  }
}
