A roster of one or more source files: the file's adjacent files (the ones it reaches and is reached by) and a flat list of the declarations inside it, by kind, name, and line.

Pass paths in `locations`; each file is answered as its own block, in input order.

It is a cheap index for finding your way around a file: what is in it and what sits next to it. To see a listed declaration's relationships or body, call expand_nodes with its handle, or query_nodes when you need fuzzy relationship discovery.
