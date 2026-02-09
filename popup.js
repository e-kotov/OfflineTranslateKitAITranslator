document.addEventListener('DOMContentLoaded', async () => {
  const autoTranslateCheckbox = document.getElementById('autoTranslate');
  const sourceLangSelect = document.getElementById('sourceLang');
  const targetLangSelect = document.getElementById('targetLang');
  const translateBtn = document.getElementById('translateBtn');

  // 1. Load saved settings
  chrome.storage.local.get(['autoTranslate', 'sourceLang', 'targetLang'], (result) => {
    autoTranslateCheckbox.checked = (result.autoTranslate !== false);
    if (result.sourceLang) sourceLangSelect.value = result.sourceLang;
    if (result.targetLang) targetLangSelect.value = result.targetLang;
  });

  // 2. Save settings on change
  autoTranslateCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ autoTranslate: autoTranslateCheckbox.checked });
  });

  sourceLangSelect.addEventListener('change', () => {
    chrome.storage.local.set({ sourceLang: sourceLangSelect.value });
  });

  targetLangSelect.addEventListener('change', () => {
    chrome.storage.local.set({ targetLang: targetLangSelect.value });
  });

  // 3. Manual Triggers
  translateBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'translate' });
      window.close();
    }
  });

  document.getElementById('undoBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'undo' });
      window.close();
    }
  });

  // 4. Open Settings
  document.getElementById('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});