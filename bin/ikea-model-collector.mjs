#!/usr/bin/env node

import { main as runCollector } from "../.agents/skills/ikea-model-collector/scripts/ikea-model-collector.mjs";
import { installSkill } from "../scripts/install-skill.mjs";

const args = process.argv.slice(2);

try {
  if (args[0] === "install") {
    const result = installSkill(args.slice(1));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    await runCollector(args);
  }
} catch (error) {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
}
