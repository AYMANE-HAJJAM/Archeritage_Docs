import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

describe("notification UX guardrails", () => {
  it("toast fallback does not call window.alert", () => {
    const source = readFileSync(
      join(process.cwd(), "components/ui/toast.tsx"),
      "utf8",
    );
    assert.equal(source.includes("window.alert"), false);
    assert.equal(source.includes("alert("), false);
  });

  it("management user actions do not use native confirm", () => {
    const source = readFileSync(
      join(process.cwd(), "components/admin/user-row-actions.tsx"),
      "utf8",
    );
    assert.equal(/\bconfirm\s*\(/.test(source), false);
    assert.ok(source.includes("ConfirmDialog"));
  });
});
