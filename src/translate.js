let isTranslating = false;

// We use WeakMap for caching. This prevents memory leaks as entries are 
// automatically removed if the DOM node is destroyed.
const nodeCache = new WeakMap(); 

// We use a Set to track which nodes are CURRENTLY translated so we can undo them.
let currentlyTranslatedNodes = new Set();

// --- UI HELPERS ---
let statusEl = null;

function showStatus(message, subtext = '') {
  if (!statusEl) {
    statusEl = document.createElement('div');
    Object.assign(statusEl.style, {
      position: 'fixed',
      top: '20px',
      left: '20px',
      padding: '12px 16px',
      background: '#222',
      color: '#fff',
      borderRadius: '8px',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      zIndex: '2147483647',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      transition: 'opacity 0.3s',
      maxWidth: '300px'
    });
    document.body.appendChild(statusEl);
  }
  
  statusEl.innerHTML = `
    <div style="font-weight:600; margin-bottom:4px">${message}</div>
    ${subtext ? `<div style="font-size:12px; opacity:0.8">${subtext}</div>` : ''}
  `;
  statusEl.style.opacity = '1';
}

function hideStatus(delay = 2000) {
  if (statusEl) {
    setTimeout(() => {
      if (statusEl) statusEl.style.opacity = '0';
      setTimeout(() => {
        if (statusEl && statusEl.parentNode) statusEl.parentNode.removeChild(statusEl);
        statusEl = null;
      }, 300);
    }, delay);
  }
}

// --- STATE MANAGEMENT ---
function getTranslationState() {
  return document.body.getAttribute('data-translatekit-state') || 'original';
}

function setTranslationState(state) {
  document.body.setAttribute('data-translatekit-state', state);
}

function undoTranslation() {
  if (getTranslationState() === 'original') return;
  
  showStatus('Restoring original text...');
  
  for (const node of currentlyTranslatedNodes) {
    const cache = nodeCache.get(node);
    if (cache) {
      node.nodeValue = cache.original;
    }
  }
  
  currentlyTranslatedNodes.clear();
  setTranslationState('original');
  hideStatus(1000);
}

// --- MAIN TRANSLATION LOGIC ---
async function translatePage() {
  if (isTranslating || getTranslationState() === 'translated') return;
  isTranslating = true;

  const settings = await new Promise(resolve => {
    chrome.storage.local.get(['sourceLang', 'targetLang', 'ignoredLanguages'], resolve);
  });

  const preferredSource = settings.sourceLang || 'auto';
  const preferredTarget = settings.targetLang || 'en';
  const ignoredLanguages = settings.ignoredLanguages || [];

  if (!('Translator' in window)) {
    showStatus('Error: API not found', 'Check brave://flags');
    isTranslating = false;
    return;
  }

  let finalSource = preferredSource;
  if (preferredSource === 'auto') {
    showStatus('Detecting language...');
    try {
      const canDetect = window.LanguageDetector ? await window.LanguageDetector.availability() : 'no';
      if (canDetect !== 'no') {
        const detector = await window.LanguageDetector.create();
        const pageText = document.body.innerText.substring(0, 2000);
        const results = await detector.detect(pageText);
        if (results && results.length > 0) finalSource = results[0].detectedLanguage;
      } else {
        finalSource = document.documentElement.lang || 'de';
      }
    } catch (e) {
      finalSource = document.documentElement.lang || 'de';
    }
  }

  if (finalSource.includes('-')) finalSource = finalSource.split('-')[0];

  if (ignoredLanguages.includes(finalSource) || finalSource === preferredTarget) {
    isTranslating = false;
    return;
  }

  try {
    const translator = await window.Translator.create({
      sourceLanguage: finalSource,
      targetLanguage: preferredTarget,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          const percent = Math.round((e.loaded / e.total) * 100);
          showStatus('Downloading AI Model', `${percent}% completed...`);
        });
      }
    });

    if (translator.ready) await translator.ready;

    showStatus('Scanning page...');
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'iframe', 'canvas'].includes(tag)) return NodeFilter.FILTER_REJECT;
          if (node.nodeValue.trim().length < 2) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    const nodesToTranslate = [];
    while (node = walker.nextNode()) nodesToTranslate.push(node);

    const total = nodesToTranslate.length;
    let count = 0;
    let cachedCount = 0;
    const chunkSize = 20;

    for (let i = 0; i < total; i += chunkSize) {
      const chunk = nodesToTranslate.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (textNode) => {
        const currentText = textNode.nodeValue;
        const cache = nodeCache.get(textNode);

        // CHECK CACHE: If we have this node translated to THIS target language
        // and the original text hasn't changed.
        if (cache && cache.original === currentText && cache.translations[preferredTarget]) {
          textNode.nodeValue = cache.translations[preferredTarget];
          currentlyTranslatedNodes.add(textNode);
          cachedCount++;
          return;
        }

        // NO CACHE: Proceed to translate
        try {
          const translated = await translator.translate(currentText.trim());
          const leadingWs = currentText.match(/^\s*/)[0];
          const trailingWs = currentText.match(/\s*$/)[0];
          const fullTranslated = leadingWs + translated + trailingWs;

          // Update cache
          const newCache = cache || { original: currentText, translations: {} };
          newCache.translations[preferredTarget] = fullTranslated;
          nodeCache.set(textNode, newCache);

          textNode.nodeValue = fullTranslated;
          currentlyTranslatedNodes.add(textNode);
          count++;
        } catch (e) {}
      }));
      
      if (i % 100 === 0) showStatus('Translating...', `${Math.round((i / total) * 100)}%`);
    }

    setTranslationState('translated');
    showStatus('Translation Complete', cachedCount > 0 ? `${count} new, ${cachedCount} cached` : `${count} elements translated`);
    hideStatus(3000);

  } catch (error) {
    showStatus('Translation Failed', error.message || 'Unknown error');
    hideStatus(5000);
  } finally {
    isTranslating = false;
  }
}

// --- LISTENERS ---

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'translate') translatePage();
  if (request.action === 'undo') undoTranslation();
  if (request.action === 'toggle') {
    if (getTranslationState() === 'translated') {
      undoTranslation();
    } else {
      translatePage();
    }
  }
});

window.addEventListener('keydown', async (e) => {
  const result = await new Promise(r => chrome.storage.local.get(['customShortcut'], r));
  const shortcut = result.customShortcut || { key: 't', altKey: true, ctrlKey: false, shiftKey: false, metaKey: false };

  if (
    e.key.toLowerCase() === shortcut.key &&
    e.ctrlKey === !!shortcut.ctrlKey &&
    e.altKey === !!shortcut.altKey &&
    e.shiftKey === !!shortcut.shiftKey &&
    e.metaKey === !!shortcut.metaKey
  ) {
    e.preventDefault();
    if (getTranslationState() === 'translated') {
      undoTranslation();
    } else {
      translatePage();
    }
  }
});

(async () => {
  await new Promise(r => setTimeout(r, 1500));
  const skipDomains = ['google.com', 'youtube.com', 'github.com', 'localhost'];
  if (skipDomains.some(d => window.location.hostname.includes(d))) return;

  chrome.storage.local.get(['autoTranslate'], (result) => {
    if (result.autoTranslate !== false) translatePage();
  });
})();