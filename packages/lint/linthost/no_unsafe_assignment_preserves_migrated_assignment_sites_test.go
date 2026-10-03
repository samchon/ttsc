package linthost

import ("path/filepath"; "strconv"; "reflect"; "strings"; "testing")

// TestNoUnsafeAssignmentPreservesMigratedAssignmentSites verifies seven unsafe
// sites while an unknown receiver stays clean.
//
// 1. Load the original annotated, inferred, default and generic fixture.
// 2. Run the owning command and compare every diagnostic line.
//
// @evidence contracts/testing.md#behavioral-verification Calls run through the real type-aware lint command and checks exit code, diagnostic messages and the complete line list, distinguishing missing assignment sites and duplicate or spurious reports.
// @evidence contracts/testing.md#independent-expectations Literal lines 3, 5, 6, 8, 13, 14 and 17 are the unsafe sites in the unchanged migrated fixture; line 4 intentionally assigns any to unknown and is absent from that independent expectation.
// @evidence contracts/testing.md#distinguishing-cases Annotated and inferred assignments, destructuring, parameter default, class field, auto-accessor and nested Set<Set<any>> to Set<Set<string>> assignment report exactly once; the unknown receiver is the negative twin.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentPreservesMigratedAssignmentSites calls the in-process check operation with the original strict NodeNext compiler options and a real Program/Checker. No contributor artifact, CLI child or installed consumer runs; package auto-discovery and native transport belong to the surviving E2E batch.
func TestNoUnsafeAssignmentPreservesMigratedAssignmentSites(t *testing.T) {
 source := "declare const leaked: any;\n\nconst explicit: string = leaked;\nconst allowedUnknown: unknown = leaked;\nconst inferred = leaked;\nconst [destructured] = leaked;\n\nfunction withDefault(value = leaked): unknown {\n  return value;\n}\n\nclass Container {\n  public value = leaked;\n  public accessor accessorValue = leaked;\n}\n\nconst genericTarget: Set<Set<string>> = new Set<Set<any>>();\n\nexport {\n  allowedUnknown,\n  Container,\n  destructured,\n  explicit,\n  genericTarget,\n  inferred,\n  withDefault,\n};\n"
 root := seedNoUnsafeAssignmentProject(t, "main.ts", source)
 writeFile(t, filepath.Join(root, "tsconfig.json"), `{"compilerOptions":{"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","strict":true,"noEmit":true,"rootDir":"src"},"files":["src/main.ts"]}`)
 writeFile(t, filepath.Join(root, "package.json"), `{"devDependencies":{"@ttsc/lint":"*"}}`)
 seedLintRules(t, root, map[string]string{"typescript/no-unsafe-assignment":"error"})
 code, stdout, stderr := captureCommandOutput(t, func() int { return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)}) })
 var lines []int
 for _, match := range noUnsafeAssignmentRenderedDiagnostic.FindAllStringSubmatch(noUnsafeAssignmentANSI.ReplaceAllString(stderr, ""), -1) {
  line, err := strconv.Atoi(match[1]); if err != nil {t.Fatal(err)}
  if !strings.HasPrefix(match[2], "Unsafe ") {t.Fatalf("unexpected message: %s",match[2])}
  lines = append(lines,line)
 }
 if code != 2 || stdout != "" || !reflect.DeepEqual(lines, []int{3,5,6,8,13,14,17}) {t.Fatalf("assignment sites: code=%d stdout=%q lines=%v stderr=%s",code,stdout,lines,stderr)}
}
