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

  // 2. Click-to-Copy Functionality
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
