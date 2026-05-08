# Bilingual EPUB Companion 需求规格

本文档记录从 Bilingual Reading Companion 浏览器扩展中沉淀出的 EPUB 阅读器需求、边界和可复用设计。目标是作为新项目 **Bilingual EPUB Companion / 双语 EPUB 阅读伴侣** 的起点。

## 背景

当前浏览器扩展已经较好地解决了英文网页阅读中的双语翻译、划词释义、发音、Obsidian 词卡/段落卡同步、欧路生词本同步等需求。

用户在阅读英文 EPUB 电子书时有类似但更完整的需求：

- 划词时能看到中文释义、音标、发音。
- 能将生词、词组、上下文和上下文翻译保存到 Obsidian。
- 能高亮好词好句、段落或书摘，并同步到 Obsidian 作为读书笔记。
- 能区分“生词学习”和“好句摘录”两类记录。
- 尽量减少手工复制、切换 app、整理格式的动作。

Apple Books 阅读体验好，但对自动化和实时扩展不友好。它不适合作为深度自研功能的承载平台。更合理的方向是另开一个专门读取 DRM-free EPUB 的个人阅读器项目。

## 产品定位

Bilingual EPUB Companion 是一个面向个人英文深度阅读和语言学习的 EPUB 阅读器。

它不是通用电子书商店，不处理 DRM，不追求替代所有专业阅读器。它专注于：

- 读英文 EPUB。
- 划词学习。
- 高亮摘录。
- 双语理解。
- Obsidian 知识沉淀。

## 非目标

第一阶段明确不做：

- 不破解或绕过 Apple Books、Kindle、Adobe DRM。
- 不深度集成 Apple Books 内部数据库。
- 不做云同步账号系统。
- 不做移动端 app。
- 不做复杂社交、书城、推荐系统。
- 不做完整 Calibre 替代品。

## 推荐技术方向

优先考虑基于 Web 技术构建桌面或本地网页应用：

- EPUB 渲染：`epub.js`
- UI：React / Vite 或类似轻量前端栈
- 桌面封装：后续可考虑 Tauri 或 Electron
- 本地存储：IndexedDB / SQLite / JSON 文件，视技术选型决定
- Obsidian 同步：优先沿用当前扩展中的 Obsidian URI Scheme，后续保留 Local REST API 可选项

如果第一版只做本地浏览器应用，可以先不做桌面封装。

## MVP 用户故事

### 导入和阅读

- 我可以导入一个 DRM-free EPUB 文件。
- 我可以看到目录并跳转章节。
- 我可以调整字号、行距、主题。
- 我可以继续上次阅读位置。
- 我可以在章节内选择英文单词、短语、句子或段落。

### 划词学习

- 当我选择单词时，弹出学习浮窗。
- 浮窗显示：
  - 原词
  - IPA 音标
  - 美音/英音/词典音频按钮
  - 简明中文释义
  - 所在句子或段落上下文
  - 可选上下文中文翻译
- 当我选择短语时，显示简明中文释义和上下文。
- 当我选择句子或段落时，显示中文翻译。
- 浮窗提供保存动作：
  - 收藏词卡
  - 收藏段落
  - 复制中英
  - 复制卡片

### 高亮和摘录

- 我可以高亮一个词、短语、句子或段落。
- 高亮类型至少包括：
  - 生词
  - 好词好句
  - 重要观点
  - 待复习
- 高亮可以添加简短备注。
- 高亮内容可以同步到 Obsidian。

### Obsidian 同步

- 每本书可以生成一个读书笔记文件。
- 生词可以进入统一词库文件，也可以进入书籍专属文件。
- 段落和好句进入书籍笔记文件。
- 同步格式应可读、可复习，而不是机器痕迹重的日志。

## Obsidian 笔记结构建议

### 书籍笔记文件

建议路径：

```text
Books/{{Book Title}}.md
```

建议结构：

```markdown
# {{Book Title}}

作者：{{Author}}
开始阅读：{{Date}}

## 书摘

---

### {{Chapter Title}}

> {{English Highlight}}

{{Chinese Translation}}

我的笔记：

- 

来源：Chapter {{Chapter}}, Location {{Location}}

#book-note #epub-reading
```

### 单词卡片

可以进入统一文件：

```text
Language Learning/EPUB Vocabulary.md
```

也可以进入书籍专属文件：

```text
Books/{{Book Title}} Vocabulary.md
```

建议格式：

```markdown
---

## 词卡：{{word}}

### 中文解释

{{meaning}}

音标：{{ipa}}

### 英文上下文

> {{context with **word** highlighted}}

### 上下文翻译

{{context translation}}

### 主动回忆

- [ ] 不看译文，复述它的意思
- [ ] 用它造一个自己的句子
- [ ] 下次复习：{{review date}}

### 来源

- 书名：{{Book Title}}
- 章节：{{Chapter Title}}
- 位置：{{Location}}
- 类型：词卡

#language-learning #epub-vocabulary
```

## 划词类型判断

沿用浏览器扩展中已经验证过的思路：

- 单词或短语：`term`
- 句子或段落：`passage`
- 用户手动标记的摘录：`highlight`

初步规则：

- 英文长度较短，词数不超过 8，且没有明显句末标点：按 `term`
- 其他选择：按 `passage`
- 高亮按钮可以允许用户覆盖类型

## 发音策略

沿用浏览器扩展中已经验证出的经验：

- 单词优先查公开词典音频和 IPA。
- 如果能识别出美音/英音，则明确标为“美音”“英音”。
- 如果无法识别口音，但确实是词典音频，则标为“词典音频”。
- 不要把低质量系统 TTS 伪装成词典原声。
- 短语或句子可以提供“系统朗读”，但必须明确标注。

后续可选增强：

- 接入更稳定的词典 API。
- 允许用户选择发音偏好：自动、美音、英音。
- 缓存音标和音频 URL。

## LLM 翻译策略

可以复用浏览器扩展中的模型配置概念：

- 翻译服务：一个 API endpoint + key + provider type
- 模型：该服务下的具体模型名
- 全文翻译和划词翻译可以使用不同服务
- 翻译风格：
  - 新闻忠实
  - 通用自然
  - 文学/散文
  - 学术精准

EPUB 阅读更偏文学和长文本，默认风格可考虑：

- 普通书籍：通用自然
- 小说、散文：文学/散文
- 非虚构、历史、社科：通用自然或学术精准

## 高亮定位

EPUB 高亮需要稳定定位，不能只保存纯文本。

建议保存：

- 书籍 ID 或文件 hash
- 章节 href
- EPUB CFI（如果使用 epub.js）
- 原文文本
- 上下文前后若干字符
- 创建时间
- 高亮类型
- 用户备注

这样即使渲染分页变化，仍有机会恢复高亮。

## 数据模型草案

```ts
type Book = {
  id: string;
  title: string;
  author?: string;
  fileName: string;
  fileHash: string;
  addedAt: string;
  lastReadAt?: string;
  currentLocation?: string;
};

type Highlight = {
  id: string;
  bookId: string;
  chapterHref: string;
  cfi: string;
  text: string;
  contextText?: string;
  translation?: string;
  note?: string;
  kind: "word" | "phrase" | "passage" | "quote" | "idea";
  tags: string[];
  createdAt: string;
  syncedToObsidianAt?: string;
};

type VocabularyCard = {
  id: string;
  bookId: string;
  term: string;
  ipa?: string;
  meaning: string;
  contextText: string;
  contextTranslation?: string;
  chapterHref?: string;
  cfi?: string;
  createdAt: string;
  eudicSyncedAt?: string;
  obsidianSyncedAt?: string;
};
```

## 与当前浏览器扩展可复用的经验

可以复用的需求和设计：

- 多翻译服务、多模型配置。
- Gemini Native 与 OpenAI-compatible API 兼容思路。
- 划词弹窗的信息结构。
- 单词/短语与句子/段落的分类逻辑。
- 音标和词典音频策略。
- Obsidian URI Scheme 同步格式。
- Local REST API 作为可选高级模式。
- 欧路生词本同步。
- README、隐私说明、发布检查习惯。

不建议直接复制的部分：

- 浏览器 content script 的 DOM 正文识别逻辑。
- Edge 扩展 manifest 和 action popup 结构。
- 针对网页正文段落的批量翻译插入逻辑。

## MVP 里程碑

### Milestone 1：EPUB 阅读基础

- 项目初始化。
- 导入 EPUB。
- 渲染目录和章节。
- 保存阅读进度。
- 支持基础主题和字号。

### Milestone 2：划词弹窗

- 选择文本后弹窗。
- 单词释义、音标、发音。
- 句子/段落翻译。
- 复制中英。

### Milestone 3：Obsidian 同步

- 保存词卡到 Obsidian。
- 保存段落/书摘到 Obsidian。
- 每本书一个读书笔记文件。
- 统一词库文件可选。

### Milestone 4：高亮系统

- EPUB CFI 高亮定位。
- 高亮分类。
- 高亮备注。
- 重新打开书籍后恢复高亮。

### Milestone 5：体验完善

- 书库管理。
- 搜索高亮和词卡。
- 导出 Markdown。
- 阅读统计。
- 更稳定的词典源。

## 初始项目建议

新项目目录建议：

```text
Bilingual EPUB Companion/
```

初始文件：

```text
EPUB_READER_SPEC.md
README.md
package.json
src/
```

第一步不急于写完整应用，先根据本文档拆出技术原型：

- 能加载一本 EPUB。
- 能选中文本并拿到选区。
- 能保存一个 highlight。
- 能生成一段 Obsidian Markdown。

只要这个闭环跑通，后续再逐步接入 LLM、发音和同步。
