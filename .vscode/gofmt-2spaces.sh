#!/usr/bin/env bash
set -euo pipefail

# gofmt indents with tabs and this repository indents Go with two spaces, so this
# wrapper is gofmt plus one normalization pass. The pass is a lexer rather than
# `s/\t/  /g` because a tab inside a string literal is data, not layout:
# `packages/lint` implements Prettier's `useTabs` and its fixtures assert
# tab-indented output. Under the whole-file substitution this replaced, those
# fixtures could only spell the tab as a `"\t"` escape, because a literal tab in a
# raw string was silently rewritten by the repository's own format command and by
# the CI gate that compares against it, so nothing reported the corruption.
#
# Comments are matched only so that a quote inside one cannot open a literal.
# A backtick is the unbounded case: an unpaired one in a comment would open a raw
# string running to the next backtick anywhere in the file, protecting every tab
# between them. An apostrophe or a double quote is the single-line case, because
# neither of those literal arms may cross a newline. Comment tabs are still
# normalized, because gofmt owns comment layout.
normalize='
  s{
      ( ` [^`]* `                             # raw string literal, spans lines
      | " (?: \\. | [^"\\\n] )* "             # interpreted string literal
      | \x27 (?: \\. | [^\x27\\\n] )* \x27    # rune literal
      )
    | ( // [^\n]*                             # line comment
      | /\* .*? \*/                           # general comment, spans lines
      )
    | \t
  }{
    defined($1) ? $1
      : defined($2) ? do { my $c = $2; $c =~ s/\t/  /g; $c }
      : "  "
  }gsex
'

space_indent() {
  perl -0777 -pe "$normalize"
}

# Keep gofmt's parser and spacing decisions, then normalize tabs to two spaces.
if [ "$#" -eq 0 ]; then
  gofmt | space_indent
  exit 0
fi

write=false
for arg in "$@"; do
  if [ "$arg" = "-w" ]; then
    write=true
    break
  fi
done

if [ "$write" = true ]; then
  # Every positional argument reaches gofmt, and the normalization has to reach
  # the same set of files gofmt writes. A directory used to reach only gofmt, so
  # `-w somedir` left every file under it tab-indented and exited 0 — the state
  # the pass below exists to remove, produced silently. A named path that does
  # not exist used to reach neither, so a typo was also a silent success; it now
  # goes to gofmt, which is what reports it.
  args=()
  files=()
  positional=0
  for arg in "$@"; do
    case "$arg" in
      -* | "") args+=("$arg") ;;
      *)
        args+=("$arg")
        positional=$((positional + 1))
        if [ -d "$arg" ]; then
          while IFS= read -r -d '' found; do
            files+=("$found")
          done < <(find "$arg" -type f -name '*.go' -print0)
        elif [ -f "$arg" ]; then
          files+=("$arg")
        fi
        ;;
    esac
  done
  if [ "$positional" -eq 0 ]; then
    exit 0
  fi
  # `gofmt -w` writes tab-indented output, which is a state this repository never
  # wants, and the normalization below is what turns it into one this repository
  # does. So a gofmt failure must not skip that pass: under `set -e` it once did,
  # and every file gofmt had already written stayed tab-indented while `xargs`
  # reported 123. One unparseable file left a whole alphabetical batch mangled
  # that way. Report gofmt's status, but only after normalizing what it wrote.
  status=0
  gofmt "${args[@]}" || status=$?
  if [ "${#files[@]}" -gt 0 ]; then
    perl -0777 -i -pe "$normalize" "${files[@]}"
  fi
  exit "$status"
else
  gofmt "$@" | space_indent
fi
