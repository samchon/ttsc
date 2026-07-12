// The sentence the baseline arm carries, and no other arm does.
//
// Every fixture is a famous open-source project, so a model has read it before.
// Asked a tour question with nothing but a repository, it answers from that
// memory: it describes the upstream project as it stands today, cites little,
// opens less, and finishes cheap. The tokens it saves that way are not a
// baseline any tool has to beat — they are a recital, and half the time the
// project has moved on and the recital is wrong.
//
// This sentence takes the memory away and sends it to the code, which is what a
// developer without the tool would actually do, and what the arm is supposed to
// stand for.
//
// It stops there. An arm holding a graph MCP already answers from this
// checkout — every fact it gets came out of the compiler that just read these
// files — so the sentence would not ground it, it would order it to go verify
// what the compiler resolved: open the files, re-find the symbols, prove they
// exist. Measured on Sonnet: the same tour that took one graph call and zero
// file reads without it takes seven reads and eight greps with it. The sentence
// is a fix for answering from memory, and only the memory arm has that problem.
export const GROUNDING =
  "Answer from this checkout's own code, not from what you may already know " +
  "about this project: every claim must trace to a symbol that exists here, " +
  "and cite the files and symbols it rests on.";
