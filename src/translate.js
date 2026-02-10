let isTranslating = false;
const originalTexts = new Map();

// Helper to check translation state
function getTranslationState() {
  return document.body.getAttribute('data-translatekit-state') || 'original';
}

function setTranslationState(state) {
  document.body.setAttribute('data-translatekit-state', state);
}

function undoTranslation() {
  if (getTranslationState() === 'original') return;
  
  console.log('TranslateKit: Reverting to original text...');
  for (const [node, originalText] of originalTexts) {
    node.nodeValue = originalText;
  }
  originalTexts.clear();
  setTranslationState('original');
  console.log('TranslateKit: Undo complete.');
}

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
    console.log('TranslateKit: Translation API not available.');
    isTranslating = false;
    return;
  }

  let finalSource = preferredSource;

  if (preferredSource === 'auto') {
    try {
      if ('LanguageDetector' in window) {
        const detector = await LanguageDetector.create();
        const pageText = document.body.innerText.substring(0, 2000);
        const results = await detector.detect(pageText);
        finalSource = results[0].detectedLanguage;
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
    const translator = await Translator.create({
      sourceLanguage: finalSource,
      targetLanguage: preferredTarget
    });

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

    const chunkSize = 15;
    for (let i = 0; i < nodesToTranslate.length; i += chunkSize) {
      const chunk = nodesToTranslate.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (textNode) => {
        const originalText = textNode.nodeValue;
        if (!originalTexts.has(textNode)) {
          originalTexts.set(textNode, originalText);
        }
        try {
          const translated = await translator.translate(originalText.trim());
          const leadingWs = originalText.match(/^\s*/)[0];
          const trailingWs = originalText.match(/\s*$/)[0];
          textNode.nodeValue = leadingWs + translated + trailingWs;
        } catch (e) {}
      }));
    }

    setTranslationState('translated');
    console.log('TranslateKit: Translation complete.');
  } catch (error) {
    console.error('TranslateKit Error:', error);
  } finally {
    isTranslating = false;
  }
}

// Global Message Listener
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

// Auto-run logic
(async () => {
  await new Promise(r => setTimeout(r, 1500));
  const skipDomains = ['google.com', 'youtube.com', 'github.com', 'localhost'];
  if (skipDomains.some(d => window.location.hostname.includes(d))) return;

  chrome.storage.local.get(['autoTranslate'], (result) => {
    if (result.autoTranslate !== false) translatePage();
  });
})();