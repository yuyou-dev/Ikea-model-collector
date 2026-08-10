#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(repositoryRoot, ".agents", "skills", "ikea-model-collector");

function parseArgs(args) {
  const options = { project: null, personal: false, force: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--personal") options.personal = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--project") options.project = args[++index] ?? ".";
    else throw new Error(`Unknown install option: ${arg}`);
  }
  if (options.personal && options.project) throw new Error("Choose either --project or --personal.");
  return options;
}

export function installSkill(args = []) {
  const options = parseArgs(args);
  const target = options.personal
    ? join(homedir(), ".codex", "skills", "ikea-model-collector")
    : join(resolve(options.project ?? "."), ".agents", "skills", "ikea-model-collector");

  if (existsSync(target)) {
    if (!options.force) throw new Error(`Skill already exists at ${target}. Re-run with --force to replace it.`);
    rmSync(target, { recursive: true });
  }

  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
  return {
    status: "installed",
    scope: options.personal ? "personal-codex" : "project",
    target,
    next: "Start a new agent conversation and mention $ikea-model-collector."
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.stdout.write(`${JSON.stringify(installSkill(process.argv.slice(2)), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
  }
}
