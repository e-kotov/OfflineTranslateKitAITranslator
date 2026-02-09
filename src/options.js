document.addEventListener('DOMContentLoaded', () => {
  const browserNameEl = document.getElementById('browserName');
  const prefixes = document.querySelectorAll('.prefix');
  const urlContainers = document.querySelectorAll('.url-container');
  const toast = document.getElementById('toast');

  // 1. Detect Browser
  let browser = 'chrome'; // Default
  let name = 'Chrome / Chromium';

  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) {
    browser = 'edge';
    name = 'Microsoft Edge';
  } else if (ua.includes('Brave') || (navigator.brave && typeof navigator.brave.isBrave === 'function')) {
    browser = 'brave';
    name = 'Brave Browser';
  } else if (ua.includes('OPR/') || ua.includes('Opera')) {
    browser = 'opera';
    name = 'Opera';
  } else if (ua.includes('Vivaldi')) {
    browser = 'vivaldi';
    name = 'Vivaldi';
  }

  // Update UI
  browserNameEl.textContent = name;
  prefixes.forEach(el => {
    el.textContent = browser;
  });

  // 2. Ignored Languages Logic
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'de', name: 'German' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' }
  ];

  const ignoredListEl = document.getElementById('ignoredLanguagesList');
  
  chrome.storage.local.get(['ignoredLanguages'], (result) => {
    const ignored = result.ignoredLanguages || [];
    
    languages.forEach(lang => {
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.cursor = 'pointer';
      
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

  // 3. Click-to-Copy Functionality
  urlContainers.forEach(container => {
    container.addEventListener('click', () => {
      const path = container.getAttribute('data-url');
      const fullUrl = `${browser}://${path}`;

      // Copy to clipboard
      navigator.clipboard.writeText(fullUrl).then(() => {
        showToast(`Copied: ${fullUrl}`);
      });
      
      // Attempt to open (most browsers block this, but some might allow it for extensions)
      // We try it anyway just in case the browser allows specific internal pages.
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
           // This usually fails for flags/internals, but works for some sub-pages
           // chrome.tabs.create({ url: fullUrl }); 
        }
      } catch (e) {
        // fail silently
      }
    });
  });

  function showToast(message) {
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 2000);
  }
});
