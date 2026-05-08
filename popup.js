const PROMPT_ORDER = ["news", "general", "literary", "academic"];

let runtimeState = null;

function $(id) {
  return document.getElementById(id);
}

function setStatus(text, isError = false) {
  const status = $("status");
  status.textContent = text || "";
  status.classList.toggle("error", Boolean(isError));
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response || !response.ok) {
        reject(new Error(response?.error || "操作失败"));
        return;
      }
      resolve(response);
    });
  });
}

async function loadState() {
  try {
    const response = await sendRuntimeMessage({ type: "GET_POPUP_STATE" });
    runtimeState = response.state;
    render();
    setStatus("设置已读取");
  } catch (err) {
    setStatus(`读取失败：${err.message}`, true);
  }
}

function getProvider(providerId) {
  return runtimeState?.providerProfiles?.find(provider => provider.id === providerId) ||
    runtimeState?.providerProfiles?.[0] ||
    null;
}

function getModelOptions(provider) {
  const models = [];
  const seen = new Set();

  [provider?.modelName, ...(provider?.models || [])].forEach(model => {
    const clean = String(model || "").trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    models.push(clean);
  });

  return models;
}

function renderProviderSelect(select, selectedId) {
  select.innerHTML = "";

  (runtimeState.providerProfiles || []).forEach(provider => {
    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = provider.name || provider.modelName || provider.id;
    if (provider.id === selectedId) option.selected = true;
    select.appendChild(option);
  });
}

function renderModelSelect(select, provider) {
  select.innerHTML = "";
  const models = getModelOptions(provider);

  if (!models.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "没有模型列表，请到设置页加载";
    select.appendChild(option);
    select.disabled = true;
    return;
  }

  select.disabled = false;
  models.forEach(model => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    if (model === provider.modelName) option.selected = true;
    select.appendChild(option);
  });
}

function renderPromptProfiles() {
  const select = $("promptProfile");
  const profiles = runtimeState.promptProfiles || {};
  select.innerHTML = "";

  PROMPT_ORDER.forEach(id => {
    if (!profiles[id]) return;
    const option = document.createElement("option");
    option.value = id;
    option.textContent = profiles[id].label || id;
    if (id === runtimeState.translation?.promptProfile) option.selected = true;
    select.appendChild(option);
  });
}

function render() {
  if (!runtimeState) return;

  const pageProvider = getProvider(runtimeState.pageProviderId);
  const selectionProvider = getProvider(runtimeState.selectionProviderId);

  renderProviderSelect($("pageProvider"), pageProvider?.id);
  renderProviderSelect($("selectionProvider"), selectionProvider?.id);
  renderModelSelect($("pageModel"), pageProvider);
  renderModelSelect($("selectionModel"), selectionProvider);
  renderPromptProfiles();

  $("pageProviderType").textContent = pageProvider?.providerType || "";
  $("selectionProviderType").textContent = selectionProvider?.providerType || "";
}

async function updateProviderRoute(useCase, providerId) {
  setStatus("正在切换 Provider…");
  const response = await sendRuntimeMessage({
    type: "SET_PROVIDER_FOR_USE_CASE",
    useCase,
    providerId
  });
  runtimeState = response.state;
  render();
  setStatus("Provider 已切换");
}

async function updateProviderModel(useCase, providerId, modelName) {
  if (!modelName) return;

  setStatus("正在切换模型…");
  const response = await sendRuntimeMessage({
    type: "SET_PROVIDER_MODEL",
    useCase,
    providerId,
    modelName
  });
  runtimeState = response.state;
  render();
  setStatus(`已切换到 ${modelName}`);
}

async function updatePromptProfile(promptProfile) {
  setStatus("正在切换翻译风格…");
  const response = await sendRuntimeMessage({
    type: "SET_PROMPT_PROFILE",
    promptProfile
  });
  runtimeState = response.state;
  render();
  setStatus("翻译风格已切换");
}

function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      if (!tab?.id) {
        reject(new Error("没有可用的当前标签页"));
        return;
      }
      resolve(tab);
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        const firstError = chrome.runtime.lastError.message;
        if (!/receiving end does not exist|could not establish connection/i.test(firstError)) {
          reject(new Error(firstError));
          return;
        }

        chrome.scripting.executeScript(
          { target: { tabId }, files: ["contentScript.js"] },
          () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              resolve(retryResponse || { ok: true });
            });
          }
        );
        return;
      }
      resolve(response || { ok: true });
    });
  });
}

async function runContentAction(message, successText) {
  try {
    const tab = await getActiveTab();
    await sendTabMessage(tab.id, message);
    setStatus(successText);
    setTimeout(() => window.close(), 350);
  } catch (err) {
    setStatus(`页面不可用：${err.message}`, true);
  }
}

$("translatePage").addEventListener("click", () => {
  runContentAction({ type: "START_BILINGUAL_TRANSLATION" }, "已开始全文翻译");
});

$("toggleTranslations").addEventListener("click", () => {
  runContentAction({ type: "TOGGLE_BILINGUAL_TRANSLATIONS" }, "已切换译文显示");
});

$("pageProvider").addEventListener("change", (event) => {
  updateProviderRoute("page", event.target.value).catch(err => setStatus(`切换失败：${err.message}`, true));
});

$("selectionProvider").addEventListener("change", (event) => {
  updateProviderRoute("selection", event.target.value).catch(err => setStatus(`切换失败：${err.message}`, true));
});

$("pageModel").addEventListener("change", (event) => {
  const providerId = $("pageProvider").value;
  updateProviderModel("page", providerId, event.target.value).catch(err => setStatus(`切换失败：${err.message}`, true));
});

$("selectionModel").addEventListener("change", (event) => {
  const providerId = $("selectionProvider").value;
  updateProviderModel("selection", providerId, event.target.value).catch(err => setStatus(`切换失败：${err.message}`, true));
});

$("promptProfile").addEventListener("change", (event) => {
  updatePromptProfile(event.target.value).catch(err => setStatus(`切换失败：${err.message}`, true));
});

$("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

$("refreshState").addEventListener("click", loadState);

loadState();
