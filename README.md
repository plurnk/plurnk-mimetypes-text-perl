# @plurnk/plurnk-mimetypes-text-perl

`text/x-perl` mimetype handler for the [plurnk](https://github.com/plurnk) ecosystem. Tier 2 — uses [tree-sitter-perl/tree-sitter-perl](https://github.com/tree-sitter-perl/tree-sitter-perl) built to WASM.

## what it does

- `package Foo::Bar;` → **module**
- `sub greet ($name) { ... }` → **function** (signature params surface in `params`)
- `my $x = ...` / `our @LIST = ...` → **variable** / **constant** (by SCREAMING_SNAKE_CASE on the bare name without sigil)
- `use constant PI => 3.14;` and `use constant { A => 1, B => 2 };` → **constant** per name

Three channels per the framework's #10 contract: symbols (above), deep-json (inherited TreeSitterExtractor walker), deep-xml (framework-projected).

Registers `text/x-perl` with `.pl`, `.pm`, `.t`, `.pod` extensions.

## license

MIT.
