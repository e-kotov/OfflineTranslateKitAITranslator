# Offline TranslateKit AI Translator

A privacy-first, on-device translation extension for Chromium-based browsers (Brave, Chrome, Edge). Unlike traditional translators, this extension performs all translations locally on your machine using the built-in Translation API—no data ever leaves your device.

## 🌟 Features
- **100% Offline:** Zero data tracking or external API calls.
- **Deep Translation:** Uses a TreeWalker engine to translate text nested inside complex web layouts.
- **Auto-translate:** Automatically detects and translates pages as you browse.
- **Manual Controls:** Toggle auto-translation on/off, or trigger manually via hotkey (**Alt + T**).
- **Undo Support:** Instantly revert to the original language with a single click.
- **Customizable:** Choose specific source and target languages when auto-detection isn't enough.

## 🛠 Setup Instructions

### 1. Enable Browser Flags
For the extension to work, you must enable the experimental Translation APIs in your browser:

1. Copy and paste these into your address bar and set to **Enabled**:
   - `brave://flags/#translation-api` (or `chrome://flags/...`)
   - `brave://flags/#translation-api-streaming-by-sentence`
   - `brave://flags/#optimization-guide-on-device-model`
2. **Restart** your browser.

### 2. Download Language Models
1. Go to `brave://on-device-translation-internals/`
2. Install the languages you wish to translate from/to.
3. Check `brave://components/` to ensure "Optimization Guide On Device Model" is updated.

### 3. Install Extension
1. Download this repository.
2. Go to `brave://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the `src` folder inside this repository.

## ⌨️ Shortcuts
- **Translate Page:** `Alt + T` (Customizable at `brave://extensions/shortcuts`)

## 🛠 Support & Feedback
If you encounter any issues or have suggestions, please **[open a GitHub Issue](https://github.com/e-kotov/OfflineTranslateKitAITranslator/issues)**. This is the preferred way to get help and keep your privacy protected.

## ⚖️ License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
