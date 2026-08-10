# 安装 Agent Skill

## 推荐：直接让智能体安装

把下面这段话发给 Codex 或其他编程智能体：

```text
请从 https://github.com/yuyou-dev/Ikea-model-collector
把 IKEA Model Collector Skill 安装到当前项目，确认 SKILL.md 和相关脚本完整，
然后告诉我如何在新对话中调用它。
```

完整、可移植的 Skill 是这个目录：

```text
.agents/skills/ikea-model-collector/
```

智能体应整体复制该目录，不要复制集合产物、缓存、下载媒体或凭据。

## 一条命令安装

安装到当前项目（适合团队和可复现工作流）：

```bash
npx --yes github:yuyou-dev/Ikea-model-collector install --project .
```

安装为 Codex 个人 Skill：

```bash
npx --yes github:yuyou-dev/Ikea-model-collector install --personal
```

项目安装位置是 `.agents/skills/ikea-model-collector`，个人安装位置是 `~/.codex/skills/ikea-model-collector`。除非明确传入 `--force`，安装器不会覆盖已有版本。

安装后请开启新对话，让智能体重新载入 Skill 清单，再提及 `$ikea-model-collector`。

## Codex Skill 安装器

如果已经可以使用 `$skill-installer`，让它安装：

```text
https://github.com/yuyou-dev/Ikea-model-collector/tree/main/.agents/skills/ikea-model-collector
```

## 手动备用方式

克隆本仓库，然后把完整 Skill 目录复制到以下任一位置：

- `<项目>/.agents/skills/ikea-model-collector`：仅当前项目使用；
- `~/.codex/skills/ikea-model-collector`：Codex 个人安装。

确认目标中同时存在 `SKILL.md`、`agents/openai.yaml`、`references/` 和 `scripts/`。不要只复制 `SKILL.md`。
