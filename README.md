# QA Agent Workbench (desktop)
Requires Node.js 18+.

    npm install
    npm start          # run the app
    npm run dist       # build installer (.exe / .dmg / AppImage) into dist/

## Providers (⚙ panel in the app)
- **Claude** - Anthropic API key (console.anthropic.com).
- **GitHub Copilot** - GitHub Models endpoint with a GitHub token (models permission).
  Microsoft 365 Copilot has no general chat API; for Azure OpenAI use Custom.
- **Custom LLM** - any OpenAI-compatible /chat/completions server (Ollama, LM Studio, vLLM, Azure...).

Keys are stored encrypted with the OS keychain (Electron safeStorage) and never reach the UI.
Lessons and stats live in the app's local storage.

## Build the Windows .exe with GitHub Actions
1. Push this folder to a GitHub repository (branch `main`).
2. Open the repo's **Actions** tab -> "Build Windows installer" (runs on every push, or click **Run workflow**).
3. When it finishes, open the run and download the **QA-Agent-Workbench-Windows** artifact (contains the Setup .exe).
4. Optional: push a tag like `v1.0.0` to also attach the .exe to a GitHub Release.
