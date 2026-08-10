import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { installSkill } from "../scripts/install-skill.mjs";

test("installs the complete Skill into a project", () => {
  const project = mkdtempSync(join(tmpdir(), "ikea-model-collector-install-"));
  try {
    const result = installSkill(["--project", project]);
    assert.equal(result.scope, "project");
    assert.equal(existsSync(join(result.target, "SKILL.md")), true);
    assert.equal(existsSync(join(result.target, "scripts", "ikea-model-collector.mjs")), true);
    assert.match(readFileSync(join(result.target, "SKILL.md"), "utf8"), /IKEA Model Collector/);
    assert.throws(() => installSkill(["--project", project]), /already exists/);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});
