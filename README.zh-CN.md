# 双语阅读伴侣

[English README](README.md)

一个面向英文长文阅读的浏览器扩展：用本地或外部 LLM 做网页双语翻译、划词翻译，并把值得记忆的词、短语、句子和段落整理到 Obsidian 与欧路词典。

它不是成熟翻译产品的通用替代品，也不是“再造一个沉浸式翻译”。它更像一个个人学习工作流：阅读时翻译，遇到值得积累的内容就顺手变成可复习的学习材料。

## 功能

- 全文双语翻译，带段落级等待状态和进度提示。
- 划词、短语、句子、段落翻译弹窗。
- 单词划词支持音标、词典原始音频，以及系统发音兜底。
- 支持多个 LLM 翻译服务配置。
- 支持 OpenAI-compatible API，例如 Open WebUI、LM Studio、Ollama 网关等。
- 支持 Gemini Native API。
- 全文翻译和划词翻译可以使用不同翻译服务。
- 支持新闻、通用、文学/散文、学术等翻译风格。
- 词卡收藏到 Obsidian：包含中文解释、英文上下文、上下文翻译、来源、复习清单、欧路链接。
- 段落卡收藏到 Obsidian。
- 可选同步短词和短语到欧路词典 OpenAPI 生词本。
- Obsidian 支持 URI Scheme，同步时不需要安装本地服务；Local REST API 作为可选高级模式保留。
- 设置页支持中文和英文。

## 安装

当前项目以未打包浏览器扩展的形式使用。

1. 下载或克隆本仓库。
2. 打开 `edge://extensions` 或 `chrome://extensions`。
3. 开启开发者模式。
4. 点击“加载解压缩的扩展”。
5. 选择本项目目录。
6. 打开扩展设置页，配置至少一个翻译服务。

## 翻译服务配置

### 本地 OpenAI-Compatible 服务

适合 Open WebUI、LM Studio 或其他兼容 Chat Completions 的本地服务。

示例：

- 服务类型：`OpenAI Compatible`
- API URL：`http://127.0.0.1:3000/api/chat/completions`
- API Key：如果本地服务不需要鉴权，可以留空
- Model：可以点击 Load Models，也可以手动填写模型名

### Gemini Native

适合 Google Gemini API。

- 服务类型：`Gemini Native`
- API Key：填写 Gemini API key
- API URL：扩展会自动填入默认 Gemini API base URL
- Model：可以 Load Models，也可以手动填写，例如 `gemini-2.5-flash`

## Obsidian 收藏

扩展可以把词卡和段落卡追加到 Obsidian vault 中的指定笔记。

URI 模式使用 Obsidian 自带的 `obsidian://` app link。第一次保存时，浏览器可能会要求确认是否打开 Obsidian；后续一般会顺畅很多。Obsidian 可能短暂抢占焦点，扩展会尝试把焦点拉回浏览器。

Local REST API 模式可以更安静，但需要额外安装 Obsidian REST 插件并开启本机服务。这个模式是可选项。

## 欧路词典同步

短词和短语可以通过欧路 OpenAPI 加入指定生词本。

登录欧路网页端后，到 OpenAPI 授权页面获取 authorization 信息，粘贴到设置页即可。

较长的句子和段落不会加到欧路，只会保存到 Obsidian。

## 隐私说明

- API key 和同步凭证保存在浏览器扩展本地存储中。
- 被翻译的选中文本和网页文本会发送给你配置的 LLM 翻译服务。
- 开启发音功能时，单词可能会通过 Free Dictionary API 查询音标和发音音频。
- 开启欧路同步时，选中的词或短语会发送给欧路 OpenAPI。
- Obsidian URI 同步会通过本机 `obsidian://` app link 传递生成的 Markdown 内容。
- 本仓库不包含个人 API key、token 或真实 vault 路径。

## 已知限制

- 有些网站 DOM 结构复杂或动态加载，全文识别可能漏掉内容。
- X、Reddit 等信息流页面比普通文章页面更难稳定处理。
- Obsidian URI 同步可能短暂切换到 Obsidian，扩展只能尝试拉回浏览器焦点，不能彻底禁止系统切焦点。
- Local REST API 是可选高级模式，需要额外 Obsidian 插件。

## 发布前检查

发布前运行：

```bash
./scripts/check-release.sh
```

脚本会检查 JavaScript 语法、manifest 图标路径，以及常见误提交密钥模式。

## License

MIT
