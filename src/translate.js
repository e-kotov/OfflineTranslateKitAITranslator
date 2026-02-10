let isTranslating = false;
const nodeCache = new WeakMap(); 
let currentlyTranslatedNodes = new Set();
let statusEl = null;

function showStatus(message, subtext = '') {
  if (!statusEl) {
    statusEl = document.createElement('div');
    Object.assign(statusEl.style, {
      position: 'fixed', top: '20px', left: '20px', padding: '12px 16px',
      background: '#222', color: '#fff', borderRadius: '8px',
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', zIndex: '2147483647',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)', transition: 'opacity 0.3s', maxWidth: '300px'
    });
    document.body.appendChild(statusEl);
  }
  statusEl.innerHTML = `<div style="font-weight:600; margin-bottom:4px">${message}</div>${subtext ? `<div style="font-size:12px; opacity:0.8">${subtext}</div>` : ''}`;
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
    if (cache) node.nodeValue = cache.original;
  }
  currentlyTranslatedNodes.clear();
  setTranslationState('original');
  hideStatus(1000);
}

async function translatePage(options = {}) {
  // If not forcing, don't re-run on already translated pages
  if (isTranslating || (!options.force && getTranslationState() === 'translated')) return;
  
  isTranslating = true;
  
  if (options.force) {
    showStatus('Force Retranslating...', 'Scanning for new content');
    // We don't clear the WeakMap (impossible), but we ignore it by setting state back
    setTranslationState('original'); 
  }

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
    try {
      const canDetect = window.LanguageDetector ? await window.LanguageDetector.availability() : 'no';
      if (canDetect !== 'no') {
        const detector = await window.LanguageDetector.create();
        const results = await detector.detect(document.body.innerText.substring(0, 2000));
        if (results && results.length > 0) finalSource = results[0].detectedLanguage;
      }
    } catch (e) {}
  }

  if (finalSource.includes('-')) finalSource = finalSource.split('-')[0];
  if (ignoredLanguages.includes(finalSource) || finalSource === preferredTarget) {
    isTranslating = false;
    hideStatus(0);
    return;
  }

  try {
    const translator = await window.Translator.create({
      sourceLanguage: finalSource, targetLanguage: preferredTarget,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          showStatus('Downloading AI Model', `${Math.round((e.loaded / e.total) * 100)}% completed...`);
        });
      }
    });

    if (translator.ready) await translator.ready;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent || ['script', 'style', 'noscript', 'iframe', 'canvas'].includes(parent.tagName.toLowerCase())) return NodeFilter.FILTER_REJECT;
        if (node.nodeValue.trim().length < 2) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let node;
    const nodesToTranslate = [];
    while (node = walker.nextNode()) nodesToTranslate.push(node);

    let count = 0;
    let cachedCount = 0;
    const chunkSize = 25;

    for (let i = 0; i < nodesToTranslate.length; i += chunkSize) {
      const chunk = nodesToTranslate.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (textNode) => {
        const currentText = textNode.nodeValue;
        const cache = nodeCache.get(textNode);

        // If forcing, we skip cache and translate again
        if (!options.force && cache && cache.original === currentText && cache.translations[preferredTarget]) {
          textNode.nodeValue = cache.translations[preferredTarget];
          currentlyTranslatedNodes.add(textNode);
          cachedCount++;
          return;
        }

        try {
          const translated = await translator.translate(currentText.trim());
          const leadingWs = currentText.match(/^\s*/)[0];
          const trailingWs = currentText.match(/\s*$/)[0];
          const fullTranslated = leadingWs + translated + trailingWs;

          const newCache = (options.force ? null : cache) || { original: currentText, translations: {} };
          if (newCache) {
            newCache.translations[preferredTarget] = fullTranslated;
            nodeCache.set(textNode, newCache);
          }

          textNode.nodeValue = fullTranslated;
          currentlyTranslatedNodes.add(textNode);
          count++;
        } catch (e) {}
      }));
      if (i % 100 === 0) showStatus('Translating...', `${Math.round((i / nodesToTranslate.length) * 100)}%`);
    }

    setTranslationState('translated');
    showStatus('Translation Complete', cachedCount > 0 ? `${count} new, ${cachedCount} cached` : `${count} elements translated`);
    hideStatus(2000);
  } catch (error) {
    showStatus('Translation Failed', error.message);
    hideStatus(5000);
  } finally {
    isTranslating = false;
  }
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'translate') translatePage({ force: request.force || false });
  if (request.action === 'undo') undoTranslation();
  if (request.action === 'toggle') {
    if (getTranslationState() === 'translated') undoTranslation();
    else translatePage();
  }
});

window.addEventListener('keydown', async (e) => {
  const result = await new Promise(r => chrome.storage.local.get(['customShortcut'], r));
  const shortcut = result.customShortcut || { key: 't', altKey: true };

  if (e.key.toLowerCase() === shortcut.key && e.ctrlKey === !!shortcut.ctrlKey && e.altKey === !!shortcut.altKey && e.shiftKey === !!shortcut.shiftKey) {
    e.preventDefault();
    if (getTranslationState() === 'translated') undoTranslation();
    else translatePage();
  }
});

(async () => {
  await new Promise(r => setTimeout(r, 1500));
  chrome.storage.local.get(['autoTranslate'], (result) => {
    if (result.autoTranslate !== false) translatePage();
  });
})();
