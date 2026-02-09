let isTranslating = false;

// We use a Map to track original text for nodes to ensure "Undo" is perfect
const originalTexts = new Map();

function undoTranslation() {
  console.log('TranslateKit: Reverting to original text...');
  for (const [node, originalText] of originalTexts) {
    node.nodeValue = originalText;
  }
  originalTexts.clear();
  console.log('TranslateKit: Undo complete.');
}

async function translatePage() {
  if (isTranslating) return;
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

  // 1. Better Language Detection
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
  console.log(`TranslateKit: Translating ${finalSource} -> ${preferredTarget}`);

  // Check if language is ignored
  if (ignoredLanguages.includes(finalSource)) {
    console.log(`TranslateKit: ${finalSource} is in the ignored list. Skipping.`);
    isTranslating = false;
    return;
  }

  if (finalSource === preferredTarget) {
    isTranslating = false;
    return;
  }

  try {
    const translator = await Translator.create({
      sourceLanguage: finalSource,
      targetLanguage: preferredTarget
    });

    // 2. Use TreeWalker to find ALL text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip script, style, and hidden elements
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const tag = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'iframe', 'canvas'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip if text is just whitespace or too short
          const text = node.nodeValue.trim();
          if (text.length < 2) return NodeFilter.FILTER_REJECT;
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    const nodesToTranslate = [];
    while (node = walker.nextNode()) {
      nodesToTranslate.push(node);
    }

    console.log(`TranslateKit: Found ${nodesToTranslate.length} text segments.`);

    // 3. Translate nodes in chunks to avoid overwhelming the API
    const chunkSize = 10;
    for (let i = 0; i < nodesToTranslate.length; i += chunkSize) {
      const chunk = nodesToTranslate.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (textNode) => {
        const originalText = textNode.nodeValue;
        
        // Save original if not already saved
        if (!originalTexts.has(textNode)) {
          originalTexts.set(textNode, originalText);
        }

        try {
          const translated = await translator.translate(originalText.trim());
          // Preserve surrounding whitespace
          const leadingWs = originalText.match(/^\s*/)[0];
          const trailingWs = originalText.match(/\s*$/)[0];
          textNode.nodeValue = leadingWs + translated + trailingWs;
        } catch (e) {
          // Keep original on error
        }
      }));
    }

    console.log('TranslateKit: Page translation complete.');
  } catch (error) {
    console.error('TranslateKit: Translation engine error', error);
  } finally {
    isTranslating = false;
  }
}

// Listeners
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'translate') translatePage();
  if (request.action === 'undo') undoTranslation();
});

(async () => {
  await new Promise(r => setTimeout(r, 1500));
  const skipDomains = ['google.com', 'youtube.com', 'github.com', 'localhost'];
  if (skipDomains.some(d => window.location.hostname.includes(d))) return;

  chrome.storage.local.get(['autoTranslate'], (result) => {
    if (result.autoTranslate !== false) translatePage();
  });
})();
