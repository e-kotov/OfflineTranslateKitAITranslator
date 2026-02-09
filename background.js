// Listen for the hotkey command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'trigger_translation') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      // Send the 'translate' message to the active tab
      chrome.tabs.sendMessage(tab.id, { action: 'translate' });
    }
  }
});
