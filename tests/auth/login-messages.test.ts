import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

describe("auth error copy", () => {
  it("login action uses non-enumerating credential and disabled messages", () => {
    const source = readFileSync(
      join(process.cwd(), "app/login/actions.ts"),
      "utf8",
    );
    assert.ok(source.includes("Adresse e-mail ou mot de passe incorrect."));
    assert.ok(
      source.includes(
        "Ce compte est désactivé. Contactez un administrateur.",
      ),
    );
  });
});
