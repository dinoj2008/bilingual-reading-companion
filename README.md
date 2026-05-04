# Bilingual Reading Companion

[中文说明](README.zh-CN.md)

LLM-powered bilingual reading, selection translation, and vocabulary capture for people who read English articles and want to turn useful words, phrases, and passages into reviewable notes.

This is not a general replacement for mature translation products such as Immersive Translate. It is a personal reading workflow: translate what you read, capture what you want to remember, and send learning material to Obsidian and Eudic.

## Features

- Full-page bilingual translation with per-paragraph progress feedback.
- Selection translation popup for words, phrases, sentences, and passages.
- Multiple provider profiles for local LLM endpoints and external APIs.
- OpenAI-compatible providers, such as Open WebUI, LM Studio, Ollama-compatible gateways, and similar chat-completion APIs.
- Gemini native provider support.
- Separate provider routing for full-page translation and selection translation.
- Translation styles for news, general prose, literary writing, and academic text.
- Term-card capture to Obsidian with the selected term, Chinese meaning, English context, translated context, source link, review checklist, and Eudic deep link.
- Passage-card capture to Obsidian.
- Optional Eudic OpenAPI sync for short word or phrase selections.
- Optional Obsidian URI sync, with Local REST API support kept as an advanced quiet mode.
- English and Chinese options UI.

## Install

This project is currently distributed as an unpacked browser extension.

1. Download or clone this repository.
2. Open `edge://extensions` or `chrome://extensions`.
3. Enable Developer mode.
4. Click "Load unpacked".
5. Select this project folder.
6. Open the extension options page and configure at least one provider profile.

## Provider Setup

### Local OpenAI-Compatible Endpoint

Use this for local tools such as Open WebUI or LM Studio.

Example:

- Provider type: `OpenAI Compatible`
- API URL: `http://127.0.0.1:3000/api/chat/completions`
- API key: leave empty if your local endpoint does not require authentication
- Model: load models or type the model name manually

### Gemini Native

Use this for Google's Gemini API.

- Provider type: `Gemini Native`
- API key: paste your Gemini API key
- API URL: the extension fills the default Gemini API base URL for you
- Model: load models or type a model name such as `gemini-2.5-flash`

## Obsidian Capture

The extension can append learning cards to a note in your Obsidian vault.

URI mode uses Obsidian's app link. The first save may require browser confirmation. Later saves are usually smoother, but Obsidian may briefly take focus; the extension can try to return focus to the browser.

Local REST API mode can be quieter, but it requires installing and running an Obsidian REST plugin. This is optional.

## Eudic Capture

Short word and phrase selections can be added to an Eudic word book through Eudic OpenAPI.

Get your authorization value from the Eudic OpenAPI authorization page after logging in, then paste it into the options page.

Longer sentence and passage selections are saved to Obsidian only.

## Privacy

- API keys and sync credentials are stored in browser extension local storage.
- Selected text and page text are sent to the LLM provider you configure.
- Eudic sync sends selected terms to Eudic OpenAPI when enabled.
- Obsidian URI sync sends generated markdown content through the local `obsidian://` app link.
- The repository does not include personal API keys, tokens, or vault paths.

## Known Limitations

- Some sites have complex or dynamic DOM structures, so full-page detection may miss content.
- Social feeds such as X or Reddit are less predictable than article pages.
- Obsidian URI sync may briefly switch focus to Obsidian. The extension can try to restore browser focus, but this cannot be guaranteed by a browser extension.
- Local REST API mode is optional and requires a separate Obsidian plugin.

## Release Check

Run this before publishing:

```bash
./scripts/check-release.sh
```

The script checks JavaScript syntax, manifest icon paths, and common accidental secret patterns.

## License

MIT
