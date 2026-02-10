// Listen for the hotkey command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'trigger_translation') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      // Send a toggle message to the content script
      chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
    }
  }
});