package linthost

import "testing"

// TestRuleCorpusUnicornPreferOptionalCatchBinding verifies
// unicorn/prefer-optional-catch-binding reports every identifier catch
// binding whose declared variable is never referenced, regardless of name.
//
// The rule resolves binding usage through the TypeScript checker, so this
// fixture pins the four cases the old name-allow-list plus raw-text scan
// missed — bindings named `err` and `exception`, a comment that spells the
// name, and a string literal that spells the name — alongside the canonical
// `e` case and a nested shadow that leaves the catch binding unused. Its
// negative twin (`log(err)`) is a genuine reference that must not report.
//
// 1. Load the annotated fixture and enable the rule from its expect comments.
// 2. Run the rule through the real Program/checker snapshot path.
// 3. Assert exactly the six annotated catch bindings are reported.
func TestRuleCorpusUnicornPreferOptionalCatchBinding(t *testing.T) {
  source := "declare function f(): void;\ndeclare function g(): void;\ndeclare function log(value: unknown): void;\n\n// A binding named `err` is unused: the dropped two-name allow-list used to\n// miss every name other than `e`/`error`.\ntry {\n  f();\n  // expect: unicorn/prefer-optional-catch-binding error\n} catch (err) {\n  g();\n}\n\n// A binding named `exception` is also outside the old allow-list.\ntry {\n  f();\n  // expect: unicorn/prefer-optional-catch-binding error\n} catch (exception) {\n  g();\n}\n\n// A comment that spells the binding name is not a reference; the old raw-text\n// scan treated it as a use and stayed silent.\ntry {\n  f();\n  // expect: unicorn/prefer-optional-catch-binding error\n} catch (error) {\n  // swallow the error\n  g();\n}\n\n// A string literal containing the binding name is not a reference either.\ntry {\n  f();\n  // expect: unicorn/prefer-optional-catch-binding error\n} catch (error) {\n  g();\n  log(\"error\");\n}\n\n// The canonical `e` case from the original fixture still reports.\ntry {\n  f();\n  // expect: unicorn/prefer-optional-catch-binding error\n} catch (e) {\n  g();\n}\n\n// A nested shadow rebinds `error`; the inner references resolve to the inner\n// declaration, so the catch binding itself stays unused and is reported.\ntry {\n  f();\n  // expect: unicorn/prefer-optional-catch-binding error\n} catch (error) {\n  {\n    const error = 1;\n    log(error);\n  }\n}\n\n// Genuine use: `log(err)` references the binding, so nothing is reported.\ntry {\n  f();\n} catch (err) {\n  log(err);\n}\n"

  expected := parseRuleExpectations(t, source)
  if len(expected) == 0 {
    t.Fatal("unicorn-prefer-optional-catch-binding.ts has no rule expectations")
  }
  _, _, findings := runRuleFindingsSnapshotFile(
    t,
    "unicorn/prefer-optional-catch-binding",
    "unicorn-prefer-optional-catch-binding.ts",
    source,
    nil,
  )
  if len(findings) != len(expected) {
    t.Fatalf("want %v, got %+v", expected, findings)
  }
  actual := normalizeRuleFindings(findings[0].File, findings)
  for index := range expected {
    if actual[index] != expected[index] {
      t.Fatalf(
        "[%d]: want %+v, got %+v; all findings=%+v",
        index,
        expected[index],
        actual[index],
        actual,
      )
    }
  }
}
