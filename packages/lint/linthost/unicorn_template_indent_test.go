package linthost

const unicornTemplateIndentRuleName = "unicorn/template-indent"

func unicornTemplateIndentSkipTestName(index int) string {
  names := []string{
    "single-line",
    "unselected-tag",
    "computed-tag",
    "call-result-tag",
    "line-comment",
    "closer-block-comment",
    "closer-line-comment",
    "comment-before-tag",
    "non-direct-function-argument",
    "already-correct",
    "existing-template-indent-fallback",
  }
  return names[index]
}
