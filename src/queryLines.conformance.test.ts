import { describe, it } from "node:test";
import { assertQueryLineConformance } from "@plurnk/plurnk-mimetypes/conformance";
import Handler from "./TextPerl.ts";

const h = new Handler({"mimetype":"text/x-perl","glyph":"🐪","extensions":[".pl",".pm",".t",".pod"]});

describe("#41 query-line conformance", () => {
    it("every structural match carries a source-line span", async () => {
        await assertQueryLineConformance(h, [{ source: "use strict;\nmy $x = 1;\nsub greet { return \"hi\"; }\n", dialect: "jsonpath", pattern: "$..*" }]);
    });
});
