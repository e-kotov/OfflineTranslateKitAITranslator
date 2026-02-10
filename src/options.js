document.addEventListener('DOMContentLoaded', async () => {
  const browserNameEl = document.getElementById('browserName');
  const prefixes = document.querySelectorAll('.prefix');
  const ignoredListEl = document.getElementById('ignoredLanguagesList');
  const toast = document.getElementById('toast');

  // 1. Detect Browser
  let browser = 'chrome'; 
  let name = 'Chrome / Chromium';
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) { 
    browser = 'edge'; 
    name = 'Microsoft Edge'; 
  } else if (ua.includes('Brave') || (navigator.brave && typeof navigator.brave.isBrave === 'function')) { 
    browser = 'brave'; 
    name = 'Brave Browser'; 
  } else if (ua.includes('OPR/')) { 
    browser = 'opera'; 
    name = 'Opera'; 
  }

  browserNameEl.textContent = name;
  prefixes.forEach(el => el.textContent = browser);

  // 2. Build Language List
  const allCodes = [
    'ar', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fa', 'fi', 'fr', 'gu', 
    'he', 'hi', 'hr', 'hu', 'id', 'it', 'ja', 'kn', 'ko', 'lt', 'lv', 'ml', 'mr', 'ms', 'nl', 
    'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'sw', 'ta', 'te', 'th', 'tr', 'uk', 
    'ur', 'vi', 'zh'
  ];

  // Shortcut Recording Logic
  const shortcutDisplay = document.getElementById('shortcutDisplay');
  const recordBtn = document.getElementById('recordShortcutBtn');
  let isRecording = false;

  chrome.storage.local.get(['customShortcut'], (result) => {
    if (result.customShortcut) {
      shortcutDisplay.textContent = result.customShortcut.display;
    }
  });

  recordBtn.addEventListener('click', () => {
    isRecording = true;
    recordBtn.textContent = 'Press keys...';
    shortcutDisplay.textContent = '---';
    recordBtn.style.background = '#4285f4';
    recordBtn.style.color = '#fff';
  });

  window.addEventListener('keydown', (e) => {
    if (!isRecording) return;
    
    // Ignore lonely modifier keys
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

    e.preventDefault();
    
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');
    parts.push(e.key.toUpperCase());

    const shortcut = {
      display: parts.join('+'),
      key: e.key.toLowerCase(),
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey
    };

    chrome.storage.local.set({ customShortcut: shortcut }, () => {
      shortcutDisplay.textContent = shortcut.display;
      recordBtn.textContent = 'Record New';
      recordBtn.style.background = '#fff';
      recordBtn.style.color = '#4285f4';
      isRecording = false;
      showToast('Shortcut saved!');
    });
  });

  const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
  let supportedCodes = allCodes;
  
  // Load saved settings and render
  chrome.storage.local.get(['ignoredLanguages'], (result) => {
    const ignored = result.ignoredLanguages || [];
    
    const sortedLangs = supportedCodes.map(code => ({
      code,
      name: displayNames.of(code) || code
    })).sort((a, b) => a.name.localeCompare(b.name));

    ignoredListEl.innerHTML = '';
    sortedLangs.forEach(lang => {
      const label = document.createElement('label');
      label.className = 'lang-item';
      label.title = lang.code;
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = lang.code;
      checkbox.checked = ignored.includes(lang.code);
      
      checkbox.addEventListener('change', () => {
        chrome.storage.local.get(['ignoredLanguages'], (current) => {
          let list = current.ignoredLanguages || [];
          if (checkbox.checked) {
            if (!list.includes(lang.code)) list.push(lang.code);
          } else {
            list = list.filter(c => c !== lang.code);
          }
          chrome.storage.local.set({ ignoredLanguages: list });
        });
      });
      
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(lang.name));
      ignoredListEl.appendChild(label);
    });
  });

  // 3. Click-to-Copy
  document.querySelectorAll('.url-container').forEach(container => {
    container.addEventListener('click', () => {
      const path = container.getAttribute('data-url');
      const fullUrl = `${browser}://${path}`;
      navigator.clipboard.writeText(fullUrl).then(() => {
        showToast(`Copied: ${fullUrl}`);
      });
    });
  });

  function showToast(message) {
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
  }
});
