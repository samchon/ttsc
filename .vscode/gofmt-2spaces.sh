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
# Comments are matched only so that a quote inside one cannot open a literal that
# swallows the rest of the file (`// don't` is the shape that does it). Their tabs
# are still normalized, because gofmt owns comment layout.
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
  args=()
  files=()
  for arg in "$@"; do
    case "$arg" in
      -* | "") args+=("$arg") ;;
      *.go)
        if [ -e "$arg" ]; then
          args+=("$arg")
          files+=("$arg")
        fi
        ;;
      *) args+=("$arg") ;;
    esac
  done
  if [ "${#files[@]}" -eq 0 ]; then
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
  perl -0777 -i -pe "$normalize" "${files[@]}"
  exit "$status"
else
  gofmt "$@" | space_indent
fi
