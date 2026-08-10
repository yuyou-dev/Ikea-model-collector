# Install the Agent Skill

## Recommended: ask your agent

Give Codex or another coding agent this instruction:

```text
Install the IKEA Model Collector Skill from
https://github.com/yuyou-dev/Ikea-model-collector
into this project, verify that SKILL.md and its scripts are present, and tell me
how to invoke it in a new conversation.
```

The complete portable Skill is the directory:

```text
.agents/skills/ikea-model-collector/
```

An agent should copy that directory as a unit. It should not copy collection output, caches, downloaded media, or credentials.

## One-command installer

Project installation (recommended for reproducible team work):

```bash
npx --yes github:yuyou-dev/Ikea-model-collector install --project .
```

Personal Codex installation:

```bash
npx --yes github:yuyou-dev/Ikea-model-collector install --personal
```

Project installs go to `.agents/skills/ikea-model-collector`. Personal installs go to `~/.codex/skills/ikea-model-collector`. Existing installs are left untouched unless `--force` is supplied.

After installation, start a new conversation so the agent refreshes its Skill catalog, then mention `$ikea-model-collector`.

## Codex Skill installer

If `$skill-installer` is already available, ask it to install:

```text
https://github.com/yuyou-dev/Ikea-model-collector/tree/main/.agents/skills/ikea-model-collector
```

## Manual fallback

Clone this repository and copy the complete Skill directory into either:

- `<project>/.agents/skills/ikea-model-collector` for one project; or
- `~/.codex/skills/ikea-model-collector` for personal Codex use.

Verify that the target contains `SKILL.md`, `agents/openai.yaml`, `references/`, and `scripts/`. Do not copy only `SKILL.md`; the scripts and references are part of the Skill.
