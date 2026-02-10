document.addEventListener('DOMContentLoaded', async () => {
  const browserNameEl = document.getElementById('browserName');
  const prefixes = document.querySelectorAll('.prefix');
  const ignoredListEl = document.getElementById('ignoredLanguagesList');
  const toast = document.getElementById('toast');

  // 1. Detect Browser
  let browser = 'chrome'; 
  let name = 'Chrome / Chromium';
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) { browser = 'edge'; name = 'Microsoft Edge'; }
  else if (ua.includes('Brave')) { browser = 'brave'; name = 'Brave Browser'; }
  else if (ua.includes('OPR/')) { browser = 'opera'; name = 'Opera'; }

  browserNameEl.textContent = name;
  prefixes.forEach(el => el.textContent = browser);

  // 2. Build Language List
  // Standard list of languages often supported by on-device models
  const allCodes = [
    'ar', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fa', 'fi', 'fr', 'gu', 
    'he', 'hi', 'hr', 'hu', 'id', 'it', 'ja', 'kn', 'ko', 'lt', 'lv', 'ml', 'mr', 'ms', 'nl', 
    'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'sw', 'ta', 'te', 'th', 'tr', 'uk', 
    'ur', 'vi', 'zh'
  ];

  // Helper to get nice names (e.g. "en" -> "English")
  const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });

  // Filter supported languages (if API is available)
  let supportedCodes = allCodes;
  
  if ('translation' in self && typeof self.translation.canTranslate === 'function') {
    try {
      const checks = await Promise.all(allCodes.map(async (code) => {
        if (code === 'en') return true;
        try {
          // Check if we can translate FROM this language TO English
          const status = await self.translation.canTranslate({
            sourceLanguage: code,
            targetLanguage: 'en'
          });
          return status !== 'no';
        } catch (e) {
          return true; // Assume yes on error to be safe
        }
      }));
      supportedCodes = allCodes.filter((_, i) => checks[i]);
    } catch (e) {
      console.log('Language availability check failed, showing all.');
    }
  }

  // Load saved settings
  chrome.storage.local.get(['ignoredLanguages'], (result) => {
    const ignored = result.ignoredLanguages || [];
    
    // Sort alphabetically by name
    const sortedLangs = supportedCodes.map(code => ({
      code,
      name: displayNames.of(code) || code
    })).sort((a, b) => a.name.localeCompare(b.name));

    // Render Checkboxes
    ignoredListEl.innerHTML = '';
    sortedLangs.forEach(lang => {
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.cursor = 'pointer';
      label.title = lang.code; // Hover to see code
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = lang.code;
      checkbox.checked = ignored.includes(lang.code);
      checkbox.style.marginRight = '8px';
      
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