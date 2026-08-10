# IKEA 模型收集器

[English](README.md)

这是一个面向 Codex 等智能体的 Agent Skill，用来把你已经在浏览器中打开并观察到的 IKEA 3D 模型响应，整理成经过验证的本地研究资料库。

它会保留商品来源、验证 GLB、记录失败，并可生成缩略图、索引、校验和、本地画廊与交接说明。它**不会**爬取 IKEA、猜测 CDN 地址、绕过访问控制，也不会让 IKEA 资产自动变成开源内容。

> IKEA 商品模型仍受 IKEA 当前条款及相关权利约束。请仅在已获授权的研究、学习等用途下使用。默认不要公开发布或再分发下载的模型。

这是一个独立、非官方项目。IKEA 是 Inter IKEA Systems B.V. 的商标；本项目与 IKEA 没有关联，也未获得其背书。

## 让智能体安装

最简单的方法是把下面这段话发给 Codex 或其他编程智能体：

```text
请从 https://github.com/yuyou-dev/Ikea-model-collector
把 IKEA Model Collector Skill 安装到当前项目，验证安装结果，
然后告诉我如何在新对话中调用它。
```

Codex 用户也可以直接调用内置 Skill 安装器：

```text
$skill-installer 请安装：
https://github.com/yuyou-dev/Ikea-model-collector/tree/main/.agents/skills/ikea-model-collector
```

如果希望自己执行一条命令，请在目标项目目录中运行：

```bash
npx --yes github:yuyou-dev/Ikea-model-collector install --project .
```

如果希望安装为 Codex 个人 Skill，让多个项目都能使用：

```bash
npx --yes github:yuyou-dev/Ikea-model-collector install --personal
```

安装器不会静默覆盖已有版本；确认需要更新时再加 `--force`。其他智能体和手动安装方法见[安装说明](docs/install.zh-CN.md)。

## 使用方式

安装后，在目标项目的新对话中发送：

```text
$ikea-model-collector 请把这个 IKEA 商品页中的 3D 模型整理到本地研究集合，
保留页面尺寸和来源证据，生成缩略图，最后完成验证并汇总结果。
```

智能体会引导你完成浏览器观察式采集。典型流程是：

1. 你确认适用的 IKEA 条款与用途。
2. 你或智能体打开 IKEA 商品页并触发 3D 视图。
3. 浏览器会话捕获实际观察到的模型响应。
4. Skill 验证 GLB，并把它保存在当前项目内。
5. Skill 记录商品信息、来源、尺寸、失败原因和哈希。
6. 可选生成预览、本地目录和 Three.js 画廊。

![本地家具资产目录](docs/images/furniture-library.png)

## 输出内容

集合默认保存在：

```text
.ikea-model-collector/collections/<collection-id>/
```

完成后的集合可以包含：

- 经过验证的本地 GLB 与 SHA-256 校验和；
- 商品页及浏览器观察到的响应来源；
- JSON/Markdown 目录和尝试记录；
- 尺寸证据与权利清单；
- Blender 缩略图和本地 Three.js 画廊；
- 验证报告与人类可读的交接说明。

本开源仓库不包含任何 IKEA 模型、贴图、缓存、凭据或单品预览；截图仅为获准展示的合成示例。

## 进阶使用

通常由 Skill 代你操作 CLI。需要直接使用命令的开发者可查看 [CLI 参考](docs/cli-reference.md)。采集边界详见[下载合同](.agents/skills/ikea-model-collector/references/download-contract.md)、[浏览器捕获](.agents/skills/ikea-model-collector/references/browser-capture.md)、[集合结构](.agents/skills/ikea-model-collector/references/collection-schema.md)与[法律边界](.agents/skills/ikea-model-collector/references/legal-boundaries.md)。

## 参与开发

需要 Node.js 22 或更新版本。验证本地检出：

```bash
npm ci
npm run check
```

CI 会运行测试、Skill 校验和仓库审计，阻止模型资产、压缩包、疑似凭据、本机绝对路径和异常大文件进入仓库。参见 [CHANGELOG.md](CHANGELOG.md)、[CONTRIBUTING.md](CONTRIBUTING.md)、[SECURITY.md](SECURITY.md)和[发布检查表](docs/release-checklist.md)。

代码采用 Apache-2.0。该许可证只覆盖本仓库的代码与文档，不覆盖用户采集的第三方商品资产。
