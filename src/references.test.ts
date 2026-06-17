import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertHandlerConformance } from "@plurnk/plurnk-mimetypes/conformance";
import TextPerl from "./TextPerl.ts";

const metadata = { mimetype: "text/x-perl", glyph: "🐪", extensions: [".pl", ".pm", ".t", ".pod"] as const };
const h = () => new TextPerl(metadata);

// Decoys live only in a comment and a string literal — they must NOT surface
// as refs. compute/normalize/render are local subs that calls resolve to.
const SRC = `package Report;

use strict;
use List::Util qw(sum);

# secret call to phantom() lives only in this comment
sub run {
    my $obj = Engine->new();
    my $raw = compute(5);
    my $clean = &normalize($raw);
    $obj->step($clean);
    my $note = "TODO render() in a string, not a call";
    my $total = sum(1, 2, 3);
    return $obj->result;
}

sub compute {
    my ($n) = @_;
    return $n * 2;
}

sub normalize {
    my ($x) = @_;
    return $x;
}

1;
`;

describe("TextPerl — references", () => {
    it("free subroutine calls are call edges scoped to the sub", async () => {
        const refs = await h().references(SRC);
        assert.ok(refs.some((r) => r.name === "compute" && r.kind === "call" && r.container === "run"));
        assert.ok(refs.some((r) => r.name === "sum" && r.kind === "call" && r.container === "run"));
    });

    it("ampersand calls capture the sigil-free name", async () => {
        const refs = await h().references(SRC);
        const norm = refs.find((r) => r.name === "normalize");
        assert.ok(norm && norm.kind === "call" && norm.container === "run");
        assert.ok(!refs.some((r) => r.name.startsWith("&")));
    });

    it("method and constructor calls are call edges on the method name", async () => {
        const refs = await h().references(SRC);
        assert.ok(refs.some((r) => r.name === "new" && r.kind === "call" && r.container === "run"));
        assert.ok(refs.some((r) => r.name === "step" && r.kind === "call" && r.container === "run"));
        assert.ok(refs.some((r) => r.name === "result" && r.kind === "call" && r.container === "run"));
    });

    it("use imports are not emitted (bareword module paths)", async () => {
        const refs = await h().references(SRC);
        assert.ok(!refs.some((r) => r.kind === "import"));
        assert.ok(!refs.some((r) => r.name === "strict" || r.name === "List::Util"));
    });

    it("passes the SPEC §16 conformance invariants", async () => {
        await assertHandlerConformance(h(), {
            source: SRC,
            decoyNames: ["phantom", "render", "secret"],
            expectJoins: [
                { refName: "compute", container: "run" },
                { refName: "normalize", container: "run" },
            ],
            expectRefs: [
                { name: "compute", kind: "call" },
                { name: "new", kind: "call" },
            ],
        });
    });
});
