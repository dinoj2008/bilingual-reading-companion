// background.js

const DEFAULT_PROVIDER_ID = "local-openwebui";

const DEFAULT_PROVIDER = {
  id: DEFAULT_PROVIDER_ID,
  name: "Local Open WebUI",
  providerType: "openai",
  apiUrl: "http://127.0.0.1:3000/api/chat/completions",
  apiKey: "",
  modelName: "qwen/qwen3-vl-8b",
  models: []
};

const DEFAULT_CAPTURE = {
  enableObsidian: false,
  obsidianMode: "uri",
  obsidianVault: "",
  obsidianFile: "Language Learning/Browser Selections.md",
  obsidianApiUrl: "https://127.0.0.1:27124",
  obsidianApiKey: "",
  translateTermContext: true,
  returnFocusAfterObsidianSave: true,
  enableEudic: false,
  eudicToken: "",
  eudicCategoryName: "browser-selection",
  eudicLanguage: "en"
};

const DEFAULT_UI = {
  selectionPopupFontSize: 15,
  pronunciationEnabled: true,
  pronunciationAccent: "auto",
  floatingBallEnabled: true,
  floatingBallPosition: "right",
  floatingBallOpacity: 82,
  floatingBallHoverOnly: false
};

const DEFAULT_TRANSLATION = {
  promptProfile: "news"
};

const PROMPT_PROFILES = {
  news: {
    label: "新闻忠实翻译",
    instruction:
      "Translate in a faithful, neutral news style. Preserve the source order, claims, attribution, names, numbers, dates, hedging, and journalistic tone. Do not embellish, summarize, infer, or soften politically sensitive wording."
  },
  general: {
    label: "通用自然翻译",
    instruction:
      "Translate naturally and clearly for a general reader. Preserve meaning and facts, while making the Chinese fluent and easy to read. Do not add information that is not present in the source."
  },
  literary: {
    label: "文学/散文翻译",
    instruction:
      "Translate with literary sensitivity. Preserve imagery, rhythm, ambiguity, voice, and emotional texture. You may choose more idiomatic Chinese phrasing when it better conveys the style, but do not add plot, facts, or interpretation."
  },
  academic: {
    label: "学术/专业翻译",
    instruction:
      "Translate in a precise academic style. Preserve terminology, logical structure, qualifiers, citations, and technical distinctions. Prefer consistency and exactness over rhetorical elegance."
  }
};

const DEFAULT_SETTINGS = {
  providerProfiles: [DEFAULT_PROVIDER],
  activeProviderId: DEFAULT_PROVIDER_ID,
  pageProviderId: DEFAULT_PROVIDER_ID,
  selectionProviderId: DEFAULT_PROVIDER_ID,
  capture: DEFAULT_CAPTURE,
  ui: DEFAULT_UI,
  translation: DEFAULT_TRANSLATION
};

let settings = structuredCloneSafe(DEFAULT_SETTINGS);
let configReady = Promise.resolve();

// Rough context budgeting. Profiles can grow a contextWindow field later.
const CONTEXT_TOKENS = 4096;
const SAFETY_RATIO = 0.7;
const MAX_CHARS_PER_BLOCK = 2000;
const MAX_TERM_CONTEXT_TRANSLATION_CHARS = 1200;
const REQUEST_TIMEOUT_MS = 300000;
const SELECTION_REQUEST_TIMEOUT_MS = 45000;
const MAX_FALLBACK_MODELS = 4;
const PRONUNCIATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PRONUNCIATION_CACHE_MAX = 300;
const pronunciationCache = new Map();

function getSystemPrompt(promptProfileId) {
  const profile = PROMPT_PROFILES[promptProfileId] || PROMPT_PROFILES.news;
  return [
    "You are a professional English-to-Simplified-Chinese translation assistant.",
    "Your task is to translate the provided English text into Simplified Chinese.",
    profile.instruction,
    "You must output a valid JSON object where keys are the paragraph IDs and values are the translations.",
    "Do not include explanations, markdown formatting, or extra text outside the JSON."
  ].join(" ");
}

function isShortSelection(text) {
  const clean = String(text || "").trim();
  if (!clean) return false;
  const words = clean.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g) || [];
  return clean.length <= 80 && words.length <= 8 && !/[.!?。！？]\s*$/.test(clean);
}

function getSelectionSystemPrompt(promptProfileId, text = "") {
  if (isShortSelection(text)) {
    return [
      "Translate the English word or short phrase into concise Simplified Chinese meanings.",
      "Output only Chinese meanings separated by /.",
      "No explanations, labels, markdown, examples, or quotation marks."
    ].join(" ");
  }

  const profile = PROMPT_PROFILES[promptProfileId] || PROMPT_PROFILES.news;
  return [
    "You are a concise English-to-Simplified-Chinese translation assistant.",
    "Translate the selected English text into Simplified Chinese.",
    profile.instruction,
    "If the input is a single word or short phrase, return only concise Chinese meanings separated by /.",
    "If the input is a sentence or paragraph, return a faithful Chinese translation.",
    "Do not include explanations, markdown, quotation marks, or extra labels."
  ].join(" ");
}

function getSelectionMaxOutputTokens(text) {
  const clean = String(text || "").trim();
  if (isShortSelection(clean)) return 96;
  if (clean.length <= 320) return 256;
  return 512;
}

const USER_PROMPT_TEMPLATE = (jsonStr) => `
Translate the following paragraphs into Simplified Chinese.
Output a JSON object with keys "1", "2", ... corresponding to the paragraph IDs.

Input Paragraphs:
${jsonStr}

Example Output:
{
  "1": "第一段翻译...",
  "2": "第二段翻译..."
}
`.trim();

function log(...args) {
  console.log("[BilingualExt BG]", ...args);
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeProvider(raw, index = 0) {
  const fallbackId = index === 0 ? DEFAULT_PROVIDER_ID : `provider-${Date.now()}-${index}`;
  return {
    ...DEFAULT_PROVIDER,
    ...(raw || {}),
    id: String(raw?.id || fallbackId),
    name: String(raw?.name || raw?.modelName || `Provider ${index + 1}`),
    providerType: raw?.providerType === "gemini" ? "gemini" : "openai",
    apiUrl: String(raw?.apiUrl || DEFAULT_PROVIDER.apiUrl),
    apiKey: String(raw?.apiKey || ""),
    modelName: String(raw?.modelName || DEFAULT_PROVIDER.modelName),
    models: Array.isArray(raw?.models) ? raw.models : []
  };
}

function normalizeSettings(items) {
  const legacyProvider = normalizeProvider({
    id: DEFAULT_PROVIDER_ID,
    name: "Migrated Local Provider",
    apiUrl: items.apiUrl || DEFAULT_PROVIDER.apiUrl,
    apiKey: items.apiKey || "",
    modelName: items.modelName || DEFAULT_PROVIDER.modelName
  });

  let providerProfiles = Array.isArray(items.providerProfiles) && items.providerProfiles.length
    ? items.providerProfiles.map(normalizeProvider)
    : [legacyProvider];

  if (!providerProfiles.length) {
    providerProfiles = [structuredCloneSafe(DEFAULT_PROVIDER)];
  }

  const knownIds = new Set(providerProfiles.map(p => p.id));
  const activeProviderId = knownIds.has(items.activeProviderId)
    ? items.activeProviderId
    : providerProfiles[0].id;

  const pageProviderId = knownIds.has(items.pageProviderId)
    ? items.pageProviderId
    : activeProviderId;

  const selectionProviderId = knownIds.has(items.selectionProviderId)
    ? items.selectionProviderId
    : activeProviderId;

  const rawCapture = items.capture || {};
  const capture = {
    ...DEFAULT_CAPTURE,
    ...rawCapture
  };

  if (rawCapture.enableObsidian && !rawCapture.obsidianMode) {
    capture.obsidianMode = "uri";
  }

  return {
    providerProfiles,
    activeProviderId,
    pageProviderId,
    selectionProviderId,
    capture,
    ui: {
      ...DEFAULT_UI,
      ...(items.ui || {})
    },
    translation: {
      ...DEFAULT_TRANSLATION,
      ...(items.translation || {})
    }
  };
}

function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get({
      providerProfiles: null,
      activeProviderId: null,
      pageProviderId: null,
      selectionProviderId: null,
      capture: null,
      ui: null,
      translation: null,
      // Legacy fields from v0.5.
      apiUrl: null,
      apiKey: null,
      modelName: null
    }, (items) => {
      settings = normalizeSettings(items);
      const active = getProviderById(settings.activeProviderId);
      log("Config loaded:", {
        profiles: settings.providerProfiles.length,
        activeProvider: active?.name,
        activeModel: active?.modelName,
        promptProfile: settings.translation.promptProfile,
        obsidian: settings.capture.enableObsidian,
        eudic: settings.capture.enableEudic
      });
      resolve(settings);
    });
  });
}

configReady = loadConfig();

async function ensureConfigReady() {
  await configReady;
}

function getProviderById(providerId) {
  return settings.providerProfiles.find(p => p.id === providerId) || settings.providerProfiles[0];
}

function getProviderForUseCase(useCase, explicitProviderId) {
  if (explicitProviderId) return getProviderById(explicitProviderId);
  if (useCase === "selection") return getProviderById(settings.selectionProviderId);
  if (useCase === "page") return getProviderById(settings.pageProviderId);
  return getProviderById(settings.activeProviderId);
}

function getPromptProfileSummaries() {
  return Object.fromEntries(
    Object.entries(PROMPT_PROFILES).map(([id, profile]) => [id, { label: profile.label }])
  );
}

function getPublicProviderSummary(provider) {
  return {
    id: provider.id,
    name: provider.name,
    providerType: provider.providerType,
    modelName: provider.modelName,
    models: Array.isArray(provider.models) ? provider.models : []
  };
}

function getRuntimeState() {
  return {
    providerProfiles: settings.providerProfiles.map(getPublicProviderSummary),
    activeProviderId: settings.activeProviderId,
    pageProviderId: settings.pageProviderId,
    selectionProviderId: settings.selectionProviderId,
    translation: settings.translation,
    ui: settings.ui,
    promptProfiles: getPromptProfileSummaries()
  };
}

function persistSettings() {
  const activeProvider = getProviderById(settings.activeProviderId);
  return new Promise((resolve) => {
    chrome.storage.local.set({
      providerProfiles: settings.providerProfiles,
      activeProviderId: settings.activeProviderId,
      pageProviderId: settings.pageProviderId,
      selectionProviderId: settings.selectionProviderId,
      capture: settings.capture,
      ui: settings.ui,
      translation: settings.translation,
      apiUrl: activeProvider?.apiUrl || "",
      apiKey: activeProvider?.apiKey || "",
      modelName: activeProvider?.modelName || ""
    }, resolve);
  });
}

function normalizeDictionaryWord(text) {
  const clean = String(text || "")
    .trim()
    .replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");

  if (!/^[A-Za-z]+(?:[-'][A-Za-z]+)?$/.test(clean)) return "";
  return clean.toLowerCase();
}

function normalizePronunciationAccent(accent) {
  return ["auto", "us", "uk"].includes(accent) ? accent : "auto";
}

function getPronunciationCacheKey(word, accent) {
  return `${normalizePronunciationAccent(accent)}:${word}`;
}

function getCachedPronunciation(key) {
  const cached = pronunciationCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.time > PRONUNCIATION_CACHE_TTL_MS) {
    pronunciationCache.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedPronunciation(key, value) {
  pronunciationCache.delete(key);
  pronunciationCache.set(key, {
    value,
    time: Date.now()
  });

  while (pronunciationCache.size > PRONUNCIATION_CACHE_MAX) {
    const oldestKey = pronunciationCache.keys().next().value;
    pronunciationCache.delete(oldestKey);
  }
}

function normalizePhoneticText(text) {
  const clean = String(text || "").trim();
  if (!clean) return "";
  if (clean.startsWith("/") && clean.endsWith("/")) return clean;
  return `/${clean.replace(/^\/|\/$/g, "")}/`;
}

function normalizeAudioUrl(url) {
  const clean = String(url || "").trim();
  if (!clean) return "";
  if (clean.startsWith("//")) return `https:${clean}`;
  if (/^https?:\/\//i.test(clean)) return clean;
  return "";
}

function detectPronunciationAccent(audioUrl) {
  const lower = String(audioUrl || "").toLowerCase();
  if (/(^|[_-])(us|am)([_-]|\d|\.)/.test(lower) || lower.includes("_us_")) return "us";
  if (/(^|[_-])(gb|uk|br)([_-]|\d|\.)/.test(lower) || lower.includes("_gb_") || lower.includes("_uk_")) return "uk";
  return "default";
}

function pickPreferredPhonetic(phonetics, accent) {
  const normalizedAccent = normalizePronunciationAccent(accent);
  const texts = phonetics
    .map(item => normalizePhoneticText(item.text))
    .filter(Boolean);

  if (!texts.length) return "";

  if (normalizedAccent === "us" || normalizedAccent === "uk") {
    const preferred = phonetics.find(item => {
      const audioUrl = normalizeAudioUrl(item.audio);
      return detectPronunciationAccent(audioUrl) === normalizedAccent && normalizePhoneticText(item.text);
    });
    if (preferred) return normalizePhoneticText(preferred.text);
  }

  return texts[0];
}

function parseDictionaryPronunciation(entries, word, accent) {
  const entryList = Array.isArray(entries) ? entries : [];
  const phonetics = entryList.flatMap(entry => Array.isArray(entry?.phonetics) ? entry.phonetics : []);
  const entryPhonetic = entryList.map(entry => normalizePhoneticText(entry?.phonetic)).find(Boolean);
  const audio = {};
  const fallbackAudio = [];

  for (const phonetic of phonetics) {
    const audioUrl = normalizeAudioUrl(phonetic?.audio);
    if (!audioUrl) continue;

    const audioAccent = detectPronunciationAccent(audioUrl);
    if (audioAccent === "us" && !audio.us) {
      audio.us = audioUrl;
    } else if (audioAccent === "uk" && !audio.uk) {
      audio.uk = audioUrl;
    } else {
      fallbackAudio.push(audioUrl);
    }
  }

  audio.default = audio.default || fallbackAudio[0] || audio.us || audio.uk || "";

  return {
    word,
    phonetic: pickPreferredPhonetic(phonetics, accent) || entryPhonetic,
    audio,
    source: "Free Dictionary API"
  };
}

async function lookupPronunciation(text, accent = "auto") {
  const word = normalizeDictionaryWord(text);
  if (!word) {
    return {
      word: String(text || "").trim(),
      phonetic: "",
      audio: {},
      source: ""
    };
  }

  const normalizedAccent = normalizePronunciationAccent(accent);
  const cacheKey = getPronunciationCacheKey(word, normalizedAccent);
  const cached = getCachedPronunciation(cacheKey);
  if (cached) return cached;

  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const response = await fetch(url);

  if (response.status === 404) {
    const emptyPronunciation = {
      word,
      phonetic: "",
      audio: {},
      source: "Free Dictionary API"
    };
    setCachedPronunciation(cacheKey, emptyPronunciation);
    return emptyPronunciation;
  }

  if (!response.ok) {
    throw new Error(`Dictionary lookup failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  const pronunciation = parseDictionaryPronunciation(data, word, normalizedAccent);
  setCachedPronunciation(cacheKey, pronunciation);
  return pronunciation;
}

function buildAuthHeaders(apiKey) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (apiKey && apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  return headers;
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.max(1, Math.floor(text.length / 4));
}

async function callLLM(textsSublist, provider, promptProfileId) {
  if (provider.providerType === "gemini") {
    return callGeminiLLM(textsSublist, provider, promptProfileId);
  }

  return callOpenAICompatibleLLM(textsSublist, provider, promptProfileId);
}

async function callOpenAICompatibleLLM(textsSublist, provider, promptProfileId) {
  const inputMap = {};
  textsSublist.forEach((t, i) => {
    inputMap[String(i + 1)] = t;
  });

  const inputJsonStr = JSON.stringify(inputMap, null, 2);
  const userContent = USER_PROMPT_TEMPLATE(inputJsonStr);
  const systemPrompt = getSystemPrompt(promptProfileId);

  const payload = {
    model: provider.modelName,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ],
    temperature: 0.2,
    top_p: 0.8
  };

  log(`Sending request to ${provider.apiUrl} with ${textsSublist.length} paragraphs...`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(provider.apiUrl, {
      method: "POST",
      headers: buildAuthHeaders(provider.apiKey),
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`API Error ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    const actualModel = data.model || provider.modelName;
    const parsed = parseTranslationResponse(content, textsSublist.length);

    return {
      results: parsed.results,
      model: actualModel,
      parseOk: parsed.ok,
      raw: content
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGeminiLLM(textsSublist, provider, promptProfileId) {
  if (!provider.apiKey || !provider.apiKey.trim()) {
    throw new Error("Gemini API key is required.");
  }

  const inputMap = {};
  textsSublist.forEach((t, i) => {
    inputMap[String(i + 1)] = t;
  });

  const inputJsonStr = JSON.stringify(inputMap, null, 2);
  const userContent = USER_PROMPT_TEMPLATE(inputJsonStr);
  const systemPrompt = getSystemPrompt(promptProfileId);
  const url = buildGeminiGenerateUrl(provider);

  const thinkingConfig = buildGeminiThinkingConfig(provider.modelName);
  const payload = {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userContent }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8
    }
  };

  if (thinkingConfig) {
    payload.generationConfig.thinkingConfig = thinkingConfig;
  }

  log(`Sending Gemini request to ${url} with ${textsSublist.length} paragraphs...`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": provider.apiKey.trim()
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini API Error ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    const content = extractGeminiText(data);
    const actualModel = data.modelVersion || provider.modelName;
    const parsed = parseTranslationResponse(content, textsSublist.length);

    return {
      results: parsed.results,
      model: actualModel,
      parseOk: parsed.ok,
      raw: content
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callSelectionLLM(text, provider, promptProfileId) {
  if (provider.providerType === "gemini") {
    return callGeminiSelectionLLM(text, provider, promptProfileId);
  }

  return callOpenAICompatibleSelectionLLM(text, provider, promptProfileId);
}

async function callOpenAICompatibleSelectionLLM(text, provider, promptProfileId) {
  const payload = {
    model: provider.modelName,
    messages: [
      { role: "system", content: getSelectionSystemPrompt(promptProfileId, text) },
      { role: "user", content: text }
    ],
    temperature: 0.1,
    top_p: 0.8,
    max_tokens: getSelectionMaxOutputTokens(text)
  };

  log(`Sending selection request to ${provider.apiUrl}...`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SELECTION_REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(provider.apiUrl, {
      method: "POST",
      headers: buildAuthHeaders(provider.apiKey),
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`API Error ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    return {
      text: String(data.choices?.[0]?.message?.content || "").trim(),
      model: data.model || provider.modelName
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGeminiSelectionLLM(text, provider, promptProfileId) {
  if (!provider.apiKey || !provider.apiKey.trim()) {
    throw new Error("Gemini API key is required.");
  }

  const thinkingConfig = buildGeminiThinkingConfig(provider.modelName, { fastSelection: true });
  const payload = {
    systemInstruction: {
      parts: [{ text: getSelectionSystemPrompt(promptProfileId, text) }]
    },
    contents: [
      {
        role: "user",
        parts: [{ text }]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      maxOutputTokens: getSelectionMaxOutputTokens(text)
    }
  };

  if (thinkingConfig) {
    payload.generationConfig.thinkingConfig = thinkingConfig;
  }

  const url = buildGeminiGenerateUrl(provider);
  log(`Sending Gemini selection request to ${url}...`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SELECTION_REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": provider.apiKey.trim()
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini API Error ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    return {
      text: extractGeminiText(data).trim(),
      model: data.modelVersion || provider.modelName
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseTranslationResponse(content, expectedCount) {
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  let jsonContent = content;

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonContent = content.substring(firstBrace, lastBrace + 1);
  }

  let translationsMap = {};

  try {
    translationsMap = JSON.parse(jsonContent);
  } catch (e) {
    log("JSON parse failed, trying regex fallback...", e);
    translationsMap = parseTranslationsWithRegex(content);
  }

  const keys = Object.keys(translationsMap);
  if (!keys.length) {
    return {
      ok: false,
      results: new Array(expectedCount).fill("")
    };
  }

  const results = [];
  for (let i = 0; i < expectedCount; i++) {
    const key = String(i + 1);
    results.push(translationsMap[key] || "");
  }

  return { ok: true, results };
}

function parseTranslationsWithRegex(content) {
  const translationsMap = {};
  const regex = /"(\d+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    try {
      const key = match[1];
      let valStr = match[2];

      valStr = valStr.replace(/[\x00-\x1F]/g, (char) => {
        if (char === "\n") return "\\n";
        if (char === "\r") return "\\r";
        if (char === "\t") return "\\t";
        return "";
      });

      translationsMap[key] = JSON.parse(`"${valStr}"`);
    } catch (err) {
      log("Regex match parse error:", err);
    }
  }

  return translationsMap;
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts
    .map(part => part.text || "")
    .filter(Boolean)
    .join("");
}

function buildGeminiGenerateUrl(provider) {
  const baseUrl = getGeminiBaseUrl(provider.apiUrl);
  const model = normalizeGeminiModelName(provider.modelName);
  return `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
}

function buildGeminiModelsUrl(apiUrl, apiKey) {
  const baseUrl = getGeminiBaseUrl(apiUrl);
  const url = new URL(`${baseUrl}/models`);
  if (apiKey && apiKey.trim()) {
    url.searchParams.set("key", apiKey.trim());
  }
  return url.href;
}

function getGeminiBaseUrl(apiUrl) {
  const fallback = "https://generativelanguage.googleapis.com/v1beta";
  const raw = String(apiUrl || "").trim() || fallback;

  try {
    const url = new URL(raw);
    const versionMatch = url.pathname.match(/^(.*?\/v\d+(?:beta|alpha)?)(?:\/.*)?$/);
    if (versionMatch) {
      url.pathname = versionMatch[1].replace(/\/$/, "");
      url.search = "";
      url.hash = "";
      return url.href.replace(/\/$/, "");
    }

    url.pathname = "/v1beta";
    url.search = "";
    url.hash = "";
    return url.href.replace(/\/$/, "");
  } catch (err) {
    return fallback;
  }
}

function normalizeGeminiModelName(modelName) {
  return String(modelName || "gemini-2.5-flash")
    .trim()
    .replace(/^models\//, "")
    .replace(/:generateContent$/, "");
}

function buildGeminiThinkingConfig(modelName, options = {}) {
  const model = normalizeGeminiModelName(modelName).toLowerCase();

  if (model.includes("gemini-3") && model.includes("flash")) {
    return { thinkingLevel: options.fastSelection ? "minimal" : "low" };
  }

  if (model.includes("gemini-3")) {
    return { thinkingLevel: "low" };
  }

  if (model.includes("gemini-2.5") && model.includes("flash")) {
    return { thinkingBudget: 0 };
  }

  return null;
}

async function translateSubTexts(subTexts, provider, promptProfileId) {
  const firstResult = await callLLM(subTexts, provider, promptProfileId);

  if (firstResult.parseOk) {
    return firstResult;
  }

  if (subTexts.length === 1) {
    return {
      ...firstResult,
      results: [firstResult.raw || firstResult.results[0] || ""]
    };
  }

  log("Batch response was not mappable JSON. Retrying paragraph-by-paragraph...");

  const results = [];
  let lastModel = firstResult.model;

  for (const text of subTexts) {
    const singleResult = await callLLM([text], provider, promptProfileId);
    lastModel = singleResult.model || lastModel;
    results.push(singleResult.results[0] || singleResult.raw || "");
  }

  return {
    results,
    model: lastModel,
    parseOk: true,
    raw: ""
  };
}

function getProviderFallbackCandidates(provider) {
  if (!provider) return [];

  const candidates = [provider];
  const seenModels = new Set([String(provider.modelName || "").trim()]);
  const configuredModels = Array.isArray(provider.models) ? provider.models : [];

  for (const modelName of configuredModels) {
    const cleanModel = String(modelName || "").trim();
    if (!cleanModel || seenModels.has(cleanModel)) continue;

    seenModels.add(cleanModel);
    candidates.push({
      ...provider,
      modelName: cleanModel
    });

    if (candidates.length >= MAX_FALLBACK_MODELS) break;
  }

  return candidates;
}

function isRetryableProviderError(err) {
  const message = String(err?.message || err || "").toLowerCase();
  return /429|503|500|502|504|quota|rate|limit|overload|overloaded|resource_exhausted|unavailable|timeout|abort|deadline|busy/.test(message);
}

async function translateSubTextsWithFallback(subTexts, providers, promptProfileId) {
  let lastError = null;

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    try {
      if (i > 0) {
        log(`Retrying translation with fallback model: ${provider.modelName}`);
      }
      return await translateSubTexts(subTexts, provider, promptProfileId);
    } catch (err) {
      lastError = err;
      if (i >= providers.length - 1 || !isRetryableProviderError(err)) {
        throw err;
      }
      log(`Provider/model failed, trying next fallback: ${err.message}`);
    }
  }

  throw lastError || new Error("Translation failed.");
}

async function translateSelectionTextWithFallback(text, providers, promptProfileId) {
  let lastError = null;

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    try {
      if (i > 0) {
        log(`Retrying selection translation with fallback model: ${provider.modelName}`);
      }
      const result = await callSelectionLLM(text, provider, promptProfileId);
      if (!result.text) {
        throw new Error("Empty selection translation.");
      }
      return result;
    } catch (err) {
      lastError = err;
      if (i >= providers.length - 1 || !isRetryableProviderError(err)) {
        throw err;
      }
      log(`Selection provider/model failed, trying next fallback: ${err.message}`);
    }
  }

  throw lastError || new Error("Selection translation failed.");
}

async function translateBatch(texts, options = {}) {
  await ensureConfigReady();
  const provider = getProviderForUseCase(options.useCase, options.providerId);
  const promptProfileId = options.promptProfile || settings.translation.promptProfile || DEFAULT_TRANSLATION.promptProfile;
  log("translateBatch called with", texts?.length || 0, "items", "provider", provider?.name, "profile", promptProfileId);

  if (!texts || !texts.length) {
    return { translations: [], modelUsed: provider?.modelName || "" };
  }

  const cleanedTexts = texts.map(t => {
    let s = String(t).trim();
    if (s.length > MAX_CHARS_PER_BLOCK) {
      s = s.substring(0, MAX_CHARS_PER_BLOCK);
    }
    return s;
  });

  const fallbackProviders = getProviderFallbackCandidates(provider);

  if (options.useCase === "selection" && cleanedTexts.length === 1) {
    const result = await translateSelectionTextWithFallback(cleanedTexts[0], fallbackProviders, promptProfileId);
    return {
      translations: [result.text],
      modelUsed: result.model
    };
  }

  const maxPromptTokens = Math.floor(CONTEXT_TOKENS * SAFETY_RATIO);
  const baseTokens = estimateTokens(getSystemPrompt(promptProfileId)) + estimateTokens(USER_PROMPT_TEMPLATE("{}"));
  const finalResults = new Array(cleanedTexts.length).fill("");
  let lastModelUsed = provider?.modelName || "";
  let idx = 0;

  while (idx < cleanedTexts.length) {
    const subTexts = [];
    const subIndices = [];
    let usedTokens = baseTokens;

    while (idx < cleanedTexts.length) {
      const t = cleanedTexts[idx];
      const tTokens = estimateTokens(t) + 10;

      if (subTexts.length === 0 && usedTokens + tTokens > maxPromptTokens) {
        subTexts.push(t);
        subIndices.push(idx);
        idx++;
        break;
      }

      if (usedTokens + tTokens > maxPromptTokens) {
        break;
      }

      subTexts.push(t);
      subIndices.push(idx);
      usedTokens += tTokens;
      idx++;
    }

    try {
      const { results: subTranslations, model } = await translateSubTextsWithFallback(subTexts, fallbackProviders, promptProfileId);
      lastModelUsed = model || lastModelUsed;

      subIndices.forEach((pos, j) => {
        if (j < subTranslations.length) {
          finalResults[pos] = subTranslations[j];
        }
      });
    } catch (err) {
      console.error("Batch failed:", err);
      subIndices.forEach((pos) => {
        finalResults[pos] = `[Error: ${err.message}]`;
      });
    }
  }

  return { translations: finalResults, modelUsed: lastModelUsed };
}

chrome.action.onClicked.addListener((tab) => {
  log("action clicked on tab", tab?.id);
  if (tab && tab.id) {
    chrome.tabs.sendMessage(
      tab.id,
      { type: "START_BILINGUAL_TRANSLATION" },
      (res) => {
        log("sendMessage START_BILINGUAL_TRANSLATION result:", chrome.runtime.lastError || res);
      }
    );
  }
});

chrome.runtime.onInstalled.addListener(() => {
  log("onInstalled: create context menu");
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "bilingual-translate-selection",
      title: "Translate selection / 翻译选中文本",
      contexts: ["selection"]
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "bilingual-translate-selection" && tab && tab.id) {
    log("contextMenus clicked on tab", tab.id);
    chrome.tabs.sendMessage(
      tab.id,
      { type: "CONTEXT_TRANSLATE_SELECTION" },
      (res) => {
        log("sendMessage CONTEXT_TRANSLATE_SELECTION result:", chrome.runtime.lastError || res);
      }
    );
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log("onMessage:", message?.type, "from", sender?.tab ? `tab ${sender.tab.id}` : "extension");

  if (message.type === "GET_POPUP_STATE") {
    ensureConfigReady()
      .then(() => sendResponse({ ok: true, state: getRuntimeState() }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "SET_PROVIDER_FOR_USE_CASE") {
    ensureConfigReady()
      .then(async () => {
        const providerId = String(message.providerId || "");
        if (!settings.providerProfiles.some(provider => provider.id === providerId)) {
          throw new Error("Unknown provider.");
        }

        if (message.useCase === "selection") {
          settings.selectionProviderId = providerId;
        } else {
          settings.pageProviderId = providerId;
        }

        settings.activeProviderId = providerId;
        await persistSettings();
        sendResponse({ ok: true, state: getRuntimeState() });
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "SET_PROVIDER_MODEL") {
    ensureConfigReady()
      .then(async () => {
        const providerId = String(message.providerId || "");
        const modelName = String(message.modelName || "").trim();
        const provider = settings.providerProfiles.find(item => item.id === providerId);

        if (!provider) throw new Error("Unknown provider.");
        if (!modelName) throw new Error("Model name is required.");

        provider.modelName = modelName;
        if (message.useCase === "selection") {
          settings.selectionProviderId = providerId;
        } else {
          settings.pageProviderId = providerId;
        }
        settings.activeProviderId = providerId;

        await persistSettings();
        sendResponse({ ok: true, state: getRuntimeState() });
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "SET_PROMPT_PROFILE") {
    ensureConfigReady()
      .then(async () => {
        const promptProfile = String(message.promptProfile || DEFAULT_TRANSLATION.promptProfile);
        if (!PROMPT_PROFILES[promptProfile]) {
          throw new Error("Unknown translation style.");
        }

        settings.translation = {
          ...settings.translation,
          promptProfile
        };

        await persistSettings();
        sendResponse({ ok: true, state: getRuntimeState() });
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "TRANSLATE_BATCH") {
    translateBatch(message.payload, {
      useCase: message.useCase,
      providerId: message.providerId,
      promptProfile: message.promptProfile
    })
      .then((result) => {
        sendResponse({ ok: true, translations: result.translations, modelUsed: result.modelUsed });
      })
      .catch((err) => {
        log("Error in translateBatch:", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  if (message.type === "CONFIG_UPDATED") {
    configReady = loadConfig();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "FETCH_MODELS") {
    const { apiUrl, apiKey, providerType } = message.payload;
    fetchModelsFromBackground(apiUrl, apiKey, providerType)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "LOOKUP_PRONUNCIATION") {
    lookupPronunciation(message.text, message.accent)
      .then(pronunciation => sendResponse({ ok: true, pronunciation }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "CAPTURE_SELECTION") {
    captureSelection(message.payload || {}, {
      sourceTabId: sender?.tab?.id,
      sourceWindowId: sender?.tab?.windowId
    })
      .then(result => sendResponse({ ok: true, ...result }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === "PAGE_TRANSLATION_STATUS" && sender?.tab?.id) {
    updateActionBadge(sender.tab.id, message.payload || {});
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

function updateActionBadge(tabId, status) {
  if (status.state === "running") {
    chrome.action.setBadgeText({ tabId, text: status.text || "…" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#2563eb" });
    chrome.action.setTitle({ tabId, title: status.title || "正在翻译页面" });
    return;
  }

  if (status.state === "done") {
    chrome.action.setBadgeText({ tabId, text: "" });
    chrome.action.setTitle({ tabId, title: "整页双语翻译" });
    return;
  }

  if (status.state === "error") {
    chrome.action.setBadgeText({ tabId, text: "!" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#b42318" });
    chrome.action.setTitle({ tabId, title: status.title || "翻译失败" });
    setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }), 3500);
  }
}

async function fetchModelsFromBackground(apiUrl, apiKey, providerType = "openai") {
  await ensureConfigReady();
  if (providerType === "gemini") {
    return fetchGeminiModels(apiUrl, apiKey);
  }

  const urls = buildModelEndpointCandidates(apiUrl);
  const headers = {};

  if (apiKey && apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  let lastError = null;

  for (const modelsUrl of urls) {
    try {
      log(`Fetching models for UI from: ${modelsUrl}`);
      const resp = await fetch(modelsUrl, { headers });

      if (resp.ok) {
        return await resp.json();
      }

      lastError = new Error(`HTTP ${resp.status} ${resp.statusText}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Unable to build models endpoint");
}

async function fetchGeminiModels(apiUrl, apiKey) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Gemini API key is required to list models.");
  }

  const modelsUrl = buildGeminiModelsUrl(apiUrl, apiKey);
  log(`Fetching Gemini models for UI from: ${modelsUrl.replace(apiKey.trim(), "***")}`);

  const resp = await fetch(modelsUrl, {
    method: "GET",
    headers: {
      "x-goog-api-key": apiKey.trim()
    }
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`HTTP ${resp.status} ${errText}`);
  }

  return await resp.json();
}

function buildModelEndpointCandidates(apiUrl) {
  const candidates = [];

  try {
    if (/\/chat\/completions\/?$/.test(apiUrl)) {
      candidates.push(apiUrl.replace(/\/chat\/completions\/?$/, "/models"));
    }

    candidates.push(new URL("/v1/models", apiUrl).href);
    candidates.push(new URL("/api/models", apiUrl).href);
  } catch (err) {
    log("Invalid API URL while building model endpoint candidates:", err);
  }

  return [...new Set(candidates)];
}

async function captureSelection(payload, context = {}) {
  await ensureConfigReady();
  const capture = settings.capture;
  const savedTargets = [];
  const errors = [];

  if (!capture.enableObsidian && !capture.enableEudic) {
    throw new Error("No learning capture target is enabled in settings.");
  }

  if (capture.enableObsidian) {
    try {
      await appendToObsidian(payload, capture, context);
      savedTargets.push("Obsidian");
    } catch (err) {
      errors.push(`Obsidian: ${err.message}`);
    }
  }

  if (capture.enableEudic && getCaptureKind(payload) === "term") {
    try {
      const result = await addToEudic(payload, capture);
      savedTargets.push(result);
    } catch (err) {
      errors.push(`Eudic: ${err.message}`);
    }
  }

  if (!savedTargets.length && errors.length) {
    throw new Error(errors.join("; "));
  }

  return { savedTargets, errors };
}

async function appendToObsidian(payload, capture, context = {}) {
  const entryPayload = await prepareObsidianPayload(payload, capture);

  if (capture.obsidianMode === "rest" && String(capture.obsidianApiKey || "").trim()) {
    return appendToObsidianRest(entryPayload, capture);
  }

  return appendToObsidianUri(entryPayload, capture, context);
}

async function prepareObsidianPayload(payload, capture) {
  const entryPayload = { ...payload };

  if (!shouldTranslateTermContext(entryPayload, capture)) {
    return entryPayload;
  }

  const contextText = getTermContextForTranslation(entryPayload);
  if (!contextText) {
    return entryPayload;
  }

  entryPayload.contextText = contextText;

  try {
    const result = await translateBatch([contextText], { useCase: "selection" });
    const contextTranslation = String(result.translations?.[0] || "").trim();

    if (contextTranslation && !contextTranslation.startsWith("[Error:")) {
      entryPayload.contextTranslation = contextTranslation;
      entryPayload.contextTranslationModel = result.modelUsed || "";
    } else {
      entryPayload.contextTranslationError = contextTranslation || "No context translation returned.";
    }
  } catch (err) {
    entryPayload.contextTranslationError = err.message || String(err);
  }

  return entryPayload;
}

function shouldTranslateTermContext(payload, capture) {
  if (capture.translateTermContext === false) return false;
  if (getCaptureKind(payload) !== "term") return false;

  const sourceText = String(payload.sourceText || "").trim();
  const contextText = String(payload.contextText || "").trim();
  return !!sourceText && !!contextText && normalizeWhitespace(contextText).length > normalizeWhitespace(sourceText).length;
}

function getTermContextForTranslation(payload) {
  const sourceText = String(payload.sourceText || "").trim();
  const contextText = normalizeWhitespace(payload.contextText || sourceText);

  if (!contextText || normalizeWhitespace(sourceText) === contextText) {
    return "";
  }

  if (contextText.length <= MAX_TERM_CONTEXT_TRANSLATION_CHARS) {
    return contextText;
  }

  const lowerContext = contextText.toLowerCase();
  const lowerSource = sourceText.toLowerCase();
  const index = lowerSource ? lowerContext.indexOf(lowerSource) : -1;

  if (index < 0) {
    return contextText.slice(0, MAX_TERM_CONTEXT_TRANSLATION_CHARS).trim();
  }

  const halfWindow = Math.floor((MAX_TERM_CONTEXT_TRANSLATION_CHARS - sourceText.length) / 2);
  const start = Math.max(0, index - halfWindow);
  const end = Math.min(contextText.length, start + MAX_TERM_CONTEXT_TRANSLATION_CHARS);
  return contextText.slice(start, end).trim();
}

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

async function appendToObsidianUri(payload, capture, context = {}) {
  if (!capture.obsidianVault.trim()) {
    throw new Error("Obsidian vault is empty.");
  }

  if (!capture.obsidianFile.trim()) {
    throw new Error("Obsidian file path is empty.");
  }

  const entry = buildObsidianEntry(payload);
  const url = buildObsidianAppendUrl(capture.obsidianVault, capture.obsidianFile, entry);

  await openObsidianUri(url, {
    sourceTabId: context.sourceTabId,
    sourceWindowId: context.sourceWindowId,
    returnFocus: capture.returnFocusAfterObsidianSave !== false
  });
}

async function openObsidianUri(url, context = {}) {
  const { sourceTabId, sourceWindowId, returnFocus } = context;

  if (sourceTabId) {
    try {
      await chrome.tabs.update(sourceTabId, { url });
      if (returnFocus) {
        await restoreEdgeFocus(sourceTabId, sourceWindowId);
      }
      return;
    } catch (err) {
      log("Opening Obsidian URI in source tab failed; falling back to background tab:", err);
    }
  }

  await chrome.tabs.create({ url, active: false });
}

async function restoreEdgeFocus(sourceTabId, sourceWindowId) {
  const delays = [500, 1100, 1800];

  await Promise.all(delays.map(async (delayMs) => {
    await sleep(delayMs);
    try {
      if (sourceWindowId !== undefined && sourceWindowId !== null) {
        await chrome.windows.update(sourceWindowId, { focused: true });
      }

      if (sourceTabId) {
        await chrome.tabs.update(sourceTabId, { active: true });
      }
    } catch (err) {
      log("Restoring Edge focus after Obsidian save failed:", err);
    }
  }));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function appendToObsidianRest(payload, capture) {
  const apiUrl = String(capture.obsidianApiUrl || DEFAULT_CAPTURE.obsidianApiUrl).trim().replace(/\/+$/, "");
  const apiKey = String(capture.obsidianApiKey || "").trim();
  const filePath = String(capture.obsidianFile || "").trim();

  if (!apiUrl) {
    throw new Error("Obsidian REST API URL is empty.");
  }

  if (!apiKey) {
    throw new Error("Obsidian REST API key is empty.");
  }

  if (!filePath) {
    throw new Error("Obsidian file path is empty.");
  }

  const entry = buildObsidianEntry(payload);
  const resp = await fetch(`${apiUrl}/vault/${encodeVaultPath(filePath)}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "text/markdown"
    },
    body: entry
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Obsidian REST HTTP ${resp.status}: ${text}`);
  }
}

function encodeVaultPath(filePath) {
  return String(filePath)
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");
}

function buildObsidianAppendUrl(vault, file, content) {
  const params = {
    vault,
    file,
    content,
    append: "true",
    silent: "true"
  };

  const query = Object.entries(params)
    .map(([key, value]) => `${strictUriEncode(key)}=${strictUriEncode(value)}`)
    .join("&");

  return `obsidian://new?${query}`;
}

function strictUriEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/\+/g, "%2B")
    .replace(/%20/g, "%20");
}

function buildObsidianEntry(payload) {
  const sourceText = String(payload.sourceText || "").trim();
  const contextText = String(payload.contextText || sourceText).trim();
  const translation = String(payload.translation || "").trim();
  const contextTranslation = String(payload.contextTranslation || "").trim();
  const pageTitle = String(payload.pageTitle || "").trim();
  const pageUrl = String(payload.pageUrl || "").trim();
  const modelUsed = String(payload.modelUsed || "").trim();
  const captureKind = getCaptureKind(payload);
  const isTermCard = captureKind === "term";
  const titleSource = isTermCard ? sourceText : contextText;
  const heading = cleanMarkdownHeading(titleSource.replace(/\s+/g, " ").slice(0, 72) || "Selection");
  const safeTitle = pageTitle || pageUrl || "Unknown page";
  const linkLine = pageUrl ? `[${escapeMarkdownLinkText(safeTitle)}](${pageUrl})` : safeTitle;
  const timestamp = formatLocalTimestamp();
  const contextTranslationBlock = getContextTranslationBlock(isTermCard, contextTranslation, translation, payload.contextTranslationError);
  const phonetic = isTermCard ? getPayloadPhonetic(payload.pronunciation) : "";
  const lines = [
    "",
    "---",
    "",
    `## ${isTermCard ? "词卡" : "段落卡"}：${heading}`,
    "",
    "### 中文解释",
    "",
    translation,
    phonetic ? "" : null,
    phonetic ? `音标：${phonetic}` : null,
    "",
    `### ${isTermCard ? "英文上下文" : "英文原文"}`,
    "",
    markdownQuote(highlightTermInText(contextText, sourceText, isTermCard)),
    "",
    `### ${isTermCard ? "上下文翻译" : "中文翻译"}`,
    "",
    contextTranslationBlock,
    "",
    "### 主动回忆",
    "",
    `- [ ] 不看译文，复述它的意思`,
    `- [ ] 用它造一个自己的句子`,
    `- [ ] 下次复习：${getReviewDate(3)}`,
    "",
    "### 来源",
    "",
    `- 页面：${linkLine}`,
    isTermCard ? `- 欧路：[${escapeMarkdownLinkText(sourceText)}](eudic://dict/${strictUriEncode(sourceText)})` : "",
    `- 类型：${isTermCard ? "词卡" : "段落卡"}`,
    `- 时间：${timestamp}`,
  ].filter(Boolean);

  if (modelUsed) {
    lines.push(`- 模型：\`${escapeInlineCode(modelUsed)}\``);
  }

  lines.push("", "#language-learning #browser-selection");

  return lines.join("\n");
}

function getPayloadPhonetic(pronunciation) {
  if (!pronunciation || typeof pronunciation !== "object") return "";
  return String(pronunciation.phonetic || "").trim();
}

function getContextTranslationBlock(isTermCard, contextTranslation, selectionTranslation, error) {
  if (!isTermCard) {
    return selectionTranslation;
  }

  if (contextTranslation) {
    return markdownQuote(contextTranslation);
  }

  if (error) {
    return "> （上下文翻译暂时失败；英文上下文已保存，可稍后复习或用全文翻译对照。）";
  }

  return "> （可在复习时自行补充或用全文翻译对照。）";
}

function getCaptureKind(payload) {
  if (payload.captureKind === "term" || payload.captureKind === "passage") {
    return payload.captureKind;
  }
  return getSelectionLearningType(payload.sourceText) === "词 / 短语" ? "term" : "passage";
}

function markdownQuote(text) {
  return String(text || "")
    .split(/\n+/)
    .map(line => `> ${line}`)
    .join("\n");
}

function highlightTermInText(text, term, shouldHighlight) {
  if (!shouldHighlight) return text;
  const escaped = escapeRegExp(String(term || "").trim());
  if (!escaped) return text;
  return String(text || "").replace(new RegExp(`(${escaped})`, "i"), "**$1**");
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSelectionLearningType(sourceText) {
  const words = String(sourceText || "").match(/[A-Za-z][A-Za-z'-]*/g) || [];
  if (sourceText.length <= 80 && words.length <= 6) {
    return "词 / 短语";
  }
  return "句子 / 片段";
}

function formatLocalTimestamp() {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function getReviewDate(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function cleanMarkdownHeading(text) {
  return String(text || "Selection")
    .replace(/^#+\s*/, "")
    .replace(/[\r\n]+/g, " ")
    .trim() || "Selection";
}

function escapeMarkdownLinkText(text) {
  return text.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function escapeInlineCode(text) {
  return text.replace(/`/g, "\\`");
}

async function addToEudic(payload, capture) {
  const token = normalizeEudicAuthorization(capture.eudicToken);
  if (!token) {
    throw new Error("Eudic token is empty.");
  }

  const terms = extractEudicTerms(payload.sourceText);
  if (!terms.length) {
    throw new Error("Selection is too long for Eudic. Saved to Obsidian instead.");
  }

  const categoryId = await ensureEudicCategory(
    capture.eudicCategoryName.trim() || DEFAULT_CAPTURE.eudicCategoryName,
    capture.eudicLanguage || DEFAULT_CAPTURE.eudicLanguage,
    token
  );

  await addWordsToEudicCategory(categoryId, terms, capture.eudicLanguage, token);

  return `Eudic (${terms.length})`;
}

function extractEudicTerms(text) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || /[\u4e00-\u9fff]/.test(cleaned)) {
    return [];
  }

  const words = cleaned.match(/[A-Za-z][A-Za-z'-]*/g) || [];

  if (!words.length) {
    return [];
  }

  if (cleaned.length <= 80 && words.length <= 6) {
    return [cleaned];
  }

  return [];
}

function normalizeEudicAuthorization(value) {
  return String(value || "")
    .trim()
    .replace(/^Authorization\s*:\s*/i, "")
    .trim();
}

async function ensureEudicCategory(name, language, token) {
  const categories = await fetchEudicCategories(language, token);
  const existing = categories.find(cat => getEudicCategoryName(cat) === name);

  if (existing) {
    return getEudicCategoryId(existing);
  }

  const created = await createEudicCategory(name, language, token);
  const categoryId = getEudicCategoryId(created);

  if (!categoryId) {
    throw new Error("Eudic category was created but no id was returned.");
  }

  return categoryId;
}

async function fetchEudicCategories(language, token) {
  const url = new URL("https://api.frdic.com/api/open/v1/studylist/category");
  url.searchParams.set("language", language || "en");

  const resp = await fetch(url.href, {
    method: "GET",
    headers: {
      Authorization: token
    }
  });

  if (!resp.ok) {
    throw new Error(`category list HTTP ${resp.status}`);
  }

  const data = await resp.json();
  return normalizeEudicCategoryList(data);
}

async function createEudicCategory(name, language, token) {
  const resp = await fetch("https://api.frdic.com/api/open/v1/studylist/category", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token
    },
    body: JSON.stringify({
      language: language || "en",
      name
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`create category HTTP ${resp.status}: ${text}`);
  }

  return await resp.json();
}

async function addWordsToEudicCategory(categoryId, words, language, token) {
  const resp = await fetch("https://api.frdic.com/api/open/v1/studylist/words", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token
    },
    body: JSON.stringify({
      id: categoryId,
      language: language || "en",
      words
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`add words HTTP ${resp.status}: ${text}`);
  }

  return await resp.json();
}

function normalizeEudicCategoryList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.categories)) return data.categories;
  if (Array.isArray(data?.result)) return data.result;
  return [];
}

function getEudicCategoryName(category) {
  return category?.name ||
    category?.categoryName ||
    category?.category_name ||
    category?.label ||
    category?.data?.name ||
    "";
}

function getEudicCategoryId(category) {
  return category?.id ||
    category?.categoryId ||
    category?.category_id ||
    category?.uuid ||
    category?.data?.id ||
    category?.data?.categoryId ||
    "";
}
