import { describe, it } from "node:test";
import assert from "node:assert/strict";
import TextPerl from "./TextPerl.ts";

const metadata = { mimetype: "text/x-perl", glyph: "🐪", extensions: [".pl", ".pm", ".t", ".pod"] as const };
const h = () => new TextPerl(metadata);

describe("TextPerl — packages", () => {
    it("package_statement → module", async () => {
        const syms = await h().extractRaw("package Foo::Bar;\n");
        assert.equal(syms.find((s) => s.name === "Foo::Bar")?.kind, "module");
    });

    it("multiple packages in one file", async () => {
        const syms = await h().extractRaw("package A;\nsub a {}\npackage B;\nsub b {}\n");
        assert.equal(syms.find((s) => s.name === "A")?.kind, "module");
        assert.equal(syms.find((s) => s.name === "B")?.kind, "module");
    });
});

describe("TextPerl — subroutines", () => {
    it("sub greet { ... } → function", async () => {
        const syms = await h().extractRaw("sub greet { my $n = shift; return $n; }\n");
        assert.equal(syms.find((s) => s.name === "greet")?.kind, "function");
    });

    it("sub with signature surfaces params", async () => {
        const syms = await h().extractRaw("sub add ($a, $b) { return $a + $b; }\n");
        const fn = syms.find((s) => s.name === "add");
        assert.equal(fn?.kind, "function");
        assert.deepEqual(fn?.params, ["a", "b"]);
    });

    it("subs without signatures still surface (empty params)", async () => {
        const syms = await h().extractRaw("sub helper { 1 }\n");
        const fn = syms.find((s) => s.name === "helper");
        assert.equal(fn?.kind, "function");
        assert.deepEqual(fn?.params, []);
    });
});

describe("TextPerl — variable declarations", () => {
    it("my $name = ... → variable", async () => {
        const syms = await h().extractRaw('my $name = "Alice";\n');
        assert.equal(syms.find((s) => s.name === "name")?.kind, "variable");
    });

    it("our @SCREAMING → constant", async () => {
        const syms = await h().extractRaw('our @TARGETS = qw(a b c);\n');
        assert.equal(syms.find((s) => s.name === "TARGETS")?.kind, "constant");
    });

    it("my %hash → variable", async () => {
        const syms = await h().extractRaw('my %config = (name => "x");\n');
        assert.equal(syms.find((s) => s.name === "config")?.kind, "variable");
    });
});

describe("TextPerl — use constant", () => {
    it("use constant PI => 3.14 → constant", async () => {
        const syms = await h().extractRaw("use constant PI => 3.14;\n");
        assert.equal(syms.find((s) => s.name === "PI")?.kind, "constant");
    });

    it("use constant {A=>1, B=>2} → multiple constants", async () => {
        const syms = await h().extractRaw("use constant { ALPHA => 1, BETA => 2 };\n");
        assert.equal(syms.find((s) => s.name === "ALPHA")?.kind, "constant");
        assert.equal(syms.find((s) => s.name === "BETA")?.kind, "constant");
    });
});

describe("TextPerl — full real-world script", () => {
    it("classic OO module: package + subs", async () => {
        const src = [
            "package Animal;",
            "use strict;",
            "sub new {",
            "    my ($class, %args) = @_;",
            "    return bless { name => $args{name} }, $class;",
            "}",
            "sub name { $_[0]->{name} }",
            "sub speak {",
            "    my $self = shift;",
            "    return $self->name;",
            "}",
            "1;",
        ].join("\n");
        const syms = await h().extractRaw(src);
        assert.equal(syms.find((s) => s.name === "Animal")?.kind, "module");
        assert.equal(syms.find((s) => s.name === "new")?.kind, "function");
        assert.equal(syms.find((s) => s.name === "name")?.kind, "function");
        assert.equal(syms.find((s) => s.name === "speak")?.kind, "function");
    });
});

describe("TextPerl — error handling", () => {
    it("empty input → []", async () => {
        assert.deepEqual(await h().extractRaw(""), []);
    });

    it("doesn't throw on malformed source", async () => {
        await assert.doesNotReject(h().extractRaw("sub ((( broken"));
    });

    it("binary content → []", async () => {
        assert.deepEqual(await h().extractRaw(new Uint8Array([1, 2, 3])), []);
    });
});

describe("TextPerl — deep-json", () => {
    it("returns parse tree with native node types", async () => {
        const tree = await h().deepJson("sub f {}\n") as { type: string; children?: unknown[] };
        assert.equal(tree.type, "source_file");
        assert.ok(Array.isArray(tree.children));
    });
});
