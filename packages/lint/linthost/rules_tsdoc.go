package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// tsdocSyntax validates a conservative subset of eslint-plugin-tsdoc's
// `tsdoc/syntax` rule. It intentionally starts with structural diagnostics
// that can be checked from source text alone: malformed top-level block tags
// and malformed or unclosed inline tags.
type tsdocSyntax struct{}

func (tsdocSyntax) Name() string           { return "tsdoc/syntax" }
func (tsdocSyntax) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }

func (tsdocSyntax) Check(ctx *Context, node *shimast.Node) {
	if ctx == nil || ctx.File == nil {
		return
	}
	src := ctx.File.Text()
	for _, block := range findJSDocBlocks(src) {
		checkTSDocBlockTags(ctx, src, block)
		checkTSDocInlineTags(ctx, src, block)
	}
}

func checkTSDocBlockTags(ctx *Context, src string, block jsdocBlock) {
	walkJSDocLines(src, block, func(contentStart, lineEnd int, inFence bool) {
		if inFence || contentStart >= lineEnd || src[contentStart] != '@' {
			return
		}
		tagStart := contentStart + 1
		if tagStart >= lineEnd || !isTSDocTagStart(src[tagStart]) {
			ctx.ReportRange(contentStart, minInt(lineEnd, contentStart+2), "Malformed TSDoc block tag.")
		}
	})
}

func checkTSDocInlineTags(ctx *Context, src string, block jsdocBlock) {
	walkJSDocLines(src, block, func(contentStart, lineEnd int, inFence bool) {
		if inFence {
			return
		}
		for i := contentStart; i+1 < lineEnd; i++ {
			if src[i] != '{' || src[i+1] != '@' {
				continue
			}
			tagStart := i + 2
			if tagStart >= lineEnd || !isTSDocTagStart(src[tagStart]) {
				ctx.ReportRange(i, minInt(lineEnd, i+2), "Malformed TSDoc inline tag.")
				continue
			}
			tagEnd := tagStart + 1
			for tagEnd < lineEnd && isTSDocTagContinue(src[tagEnd]) {
				tagEnd++
			}
			close := findByteInRange(src, '}', tagEnd, block.bodyEnd)
			if close < 0 {
				ctx.ReportRange(i, tagEnd, "Unclosed TSDoc inline tag.")
				i = tagEnd - 1
				continue
			}
			i = close
		}
	})
}

func walkJSDocLines(src string, block jsdocBlock, visit func(contentStart, lineEnd int, inFence bool)) {
	inFence := false
	for lineStart := block.bodyStart; lineStart < block.bodyEnd; {
		lineEnd := lineStart
		for lineEnd < block.bodyEnd && src[lineEnd] != '\n' {
			lineEnd++
		}
		contentStart := tsdocLineContentStart(src, lineStart, lineEnd)
		visit(contentStart, trimLineEnd(src, lineEnd), inFence)
		if startsWithFenceMarker(src, contentStart, trimLineEnd(src, lineEnd)) {
			inFence = !inFence
		}
		if lineEnd >= block.bodyEnd {
			break
		}
		lineStart = lineEnd + 1
	}
}

func tsdocLineContentStart(src string, lineStart, lineEnd int) int {
	i := lineStart
	for i < lineEnd && (src[i] == ' ' || src[i] == '\t' || src[i] == '\r') {
		i++
	}
	if i < lineEnd && src[i] == '*' {
		i++
		if i < lineEnd && src[i] == ' ' {
			i++
		}
	}
	return i
}

func trimLineEnd(src string, lineEnd int) int {
	for lineEnd > 0 && src[lineEnd-1] == '\r' {
		lineEnd--
	}
	return lineEnd
}

func startsWithFenceMarker(src string, start, end int) bool {
	return end-start >= 3 && src[start] == '`' && src[start+1] == '`' && src[start+2] == '`'
}

func findByteInRange(src string, target byte, start, end int) int {
	for i := start; i < end; i++ {
		if src[i] == target {
			return i
		}
	}
	return -1
}

func isTSDocTagStart(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z')
}

func isTSDocTagContinue(b byte) bool {
	return isTSDocTagStart(b) || (b >= '0' && b <= '9') || b == '-'
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func init() {
	Register(tsdocSyntax{})
}
