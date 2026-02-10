document.addEventListener('DOMContentLoaded', async () => {
  const autoTranslateCheckbox = document.getElementById('autoTranslate');
  const sourceLangSelect = document.getElementById('sourceLang');
  const targetLangSelect = document.getElementById('targetLang');
  const translateBtn = document.getElementById('translateBtn');
  const undoBtn = document.getElementById('undoBtn');

  // --- POPULATE DROPDOWNS ---
  const allCodes = [
    'ar', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fa', 'fi', 'fr', 'gu', 
    'he', 'hi', 'hr', 'hu', 'id', 'it', 'ja', 'kn', 'ko', 'lt', 'lv', 'ml', 'mr', 'ms', 'nl', 
    'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'sw', 'ta', 'te', 'th', 'tr', 'uk', 
    'ur', 'vi', 'zh'
  ];
  
  const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
  const sortedLangs = allCodes.map(code => ({
    code,
    name: displayNames.of(code) || code
  })).sort((a, b) => a.name.localeCompare(b.name));

  // 1. Source: Add "Auto-detect" first
  const autoOpt = document.createElement('option');
  autoOpt.value = 'auto';
  autoOpt.textContent = 'Auto-detect';
  sourceLangSelect.appendChild(autoOpt);

  sortedLangs.forEach(lang => {
    // Source options
    const sOpt = document.createElement('option');
    sOpt.value = lang.code;
    sOpt.textContent = lang.name;
    sourceLangSelect.appendChild(sOpt);

    // Target options
    const tOpt = document.createElement('option');
    tOpt.value = lang.code;
    tOpt.textContent = lang.name;
    targetLangSelect.appendChild(tOpt);
  });
  // ---------------------------

  // 1. Load saved settings
  chrome.storage.local.get(['autoTranslate', 'sourceLang', 'targetLang'], (result) => {
    autoTranslateCheckbox.checked = (result.autoTranslate !== false);
    if (result.sourceLang) sourceLangSelect.value = result.sourceLang;
    if (result.targetLang) targetLangSelect.value = result.targetLang;
    else targetLangSelect.value = 'en'; // Default target
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
      chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
      window.close();
    }
  });

  document.getElementById('forceTranslateBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'translate', force: true });
      window.close();
    }
  });

  undoBtn.addEventListener('click', async () => {
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
