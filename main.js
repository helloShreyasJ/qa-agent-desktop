/**
 * Import required modules from Electron
 * app: Controls your application's event lifecycle.
 * BrowserWindow: Creates and manages application windows.
 * ipcMain: Communicates asynchronously from the main process to renderer processes.
 * safeStorage: Allows accessing simple encryption and decryption of strings.
 * dialog: Displays native system dialogs for opening and saving files, alerting, etc.
 * shell: Manages files and URLs using their default applications.
 */
const {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  dialog,
  shell,
} = require("electron");

/**
 * Node.js built-in modules
 * fs: File system module for reading and writing files.
 * path: Path module for working with file and directory paths.
 */
const fs = require("fs"),
  path = require("path");

/**
 * Default configuration object containing settings for different AI providers.
 * Each provider has its specific base URL and default model version.
 */
const DEFAULTS = {
  // Default provider to use when none is configured
  provider: "claude",
  // Settings for Anthropic's Claude
  claude: { model: "claude-sonnet-5-5" },
  // Settings for GitHub Copilot models
  copilot: {
    baseUrl: "https://models.github.ai/inference",
    model: "openai/gpt-4.1",
  },
  // Settings for a Custom local/remote OpenAI-compatible provider
  custom: { baseUrl: "http://localhost:11434/v1", model: "llama3.1" },
  // OpenRouter acts as a unified gateway to multiple LLMs; requires a specific base URL
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o",
  },
  // Gemini free tier via Google AI Studio's OpenAI compatibility layer
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: "gemini-3.8-flash",
  },
};
/**
 * Returns the absolute path to the configuration file (config.json)
 * located in the user's secure application data directory.
 * @returns {string} Path to config.json
 */
const cfgFile = () => path.join(app.getPath("userData"), "config.json");

/**
 * Loads the user's application configuration from the file system.
 * If the file doesn't exist or is invalid JSON, it falls back to DEFAULTS.
 * @returns {Object} The current merged configuration object.
 */
function loadConfig() {
  try {
    // Read the file synchronously and parse the JSON string into an object
    const config = JSON.parse(fs.readFileSync(cfgFile(), "utf8"));
    // Return a merged object combining DEFAULTS and any custom user config
    return {
      provider: config.provider || "claude",
      claude: { ...DEFAULTS.claude, ...config.claude },
      copilot: { ...DEFAULTS.copilot, ...config.copilot },
      custom: { ...DEFAULTS.custom, ...config.custom },
      openrouter: { ...DEFAULTS.openrouter, ...config.openrouter },
      gemini: { ...DEFAULTS.gemini, ...config.gemini },
    };
  } catch {
    // If the file is missing or corrupt, return a deep clone of DEFAULTS
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

/**
 * Saves the provided configuration object to the file system as JSON.
 * @param {Object} config - The configuration object to save.
 */
const saveConfigToFile = (config) =>
  fs.writeFileSync(cfgFile(), JSON.stringify(config, null, 2));
/**
 * Encrypts a plain text string using the OS keychain if available.
 * Adds a prefix "enc:" if encrypted, or "raw:" if plaintext fallback is used.
 * @param {string} text - The plain text string to encrypt.
 * @returns {string} The base64 encoded string with its prefix.
 */
// API keys are encrypted with the OS keychain (safeStorage) when available.
const encryptText = (text) =>
  safeStorage.isEncryptionAvailable()
    ? "enc:" + safeStorage.encryptString(text).toString("base64")
    : "raw:" + Buffer.from(text).toString("base64");

/**
 * Decrypts a previously encrypted or raw string.
 * Uses the prefix to determine if safeStorage decryption is needed.
 * @param {string} text - The prefixed, base64 encoded string to decrypt.
 * @returns {string} The decrypted plain text string.
 */
const decryptText = (text) =>
  !text
    ? ""
    : text.startsWith("enc:")
      ? safeStorage.decryptString(Buffer.from(text.slice(4), "base64"))
      : Buffer.from(text.slice(4), "base64").toString();

/**
 * IPC Handler: 'cfg:get'
 * Called by the renderer process to fetch the current configuration.
 * Removes the raw API keys from the payload and adds a boolean 'hasKey' flag instead
 * so that secrets are not needlessly sent to the renderer process.
 */
ipcMain.handle("cfg:get", () => {
  // Load the full config
  const config = loadConfig(),
    // Initialize the output payload with the current active provider
    output = { provider: config.provider };
    
  // Iterate through all supported AI providers
  for (const provider of ["claude", "copilot", "custom", "openrouter", "gemini"]) {
    // Extract the 'key' property separately to keep it secret
    const { key, ...rest } = config[provider] || DEFAULTS[provider];
    // Attach the rest of the settings and a simple boolean flag indicating if a key exists
    output[provider] = { ...rest, hasKey: !!key };
  }
  
  // Return the sanitized configuration payload to the renderer
  return output;
});
/**
 * IPC Handler: 'cfg:save'
 * Called by the renderer process to patch the current configuration with new values.
 * Automatically encrypts any new API keys that are passed before saving.
 */
ipcMain.handle("cfg:save", (event, patch) => {
  // Load the existing configuration from disk
  const config = loadConfig();
  
  // Update the active provider if specified in the patch
  if (patch.provider) config.provider = patch.provider;
  
  // Merge provider-specific settings from the patch into the existing config
  for (const provider of ["claude", "copilot", "custom", "openrouter", "gemini"])
    if (patch[provider]) config[provider] = { ...config[provider], ...patch[provider] };
    
  // Encrypt and save any incoming API keys to the respective provider's object
  if (patch.key) config[patch.keyFor].key = encryptText(patch.key);
  
  // Write the updated configuration back to the file system
  saveConfigToFile(config);
  
  // Return a success boolean
  return true;
});
/**
 * Helper function to send an asynchronous HTTP POST request.
 * Automatically handles JSON parsing and error throwing on bad HTTP statuses.
 * @param {string} url - The endpoint URL to send the request to.
 * @param {Object} headers - Additional HTTP headers (e.g., Authorization).
 * @param {Object} body - The request payload body (automatically stringified).
 * @returns {Promise<Object>} A promise resolving to the parsed JSON response.
 */
async function post(url, headers, body) {
  // Await the fetch response, attaching standard POST headers and body
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000), // 3-minute timeout for slow models
  });
  
  // Read the raw text response from the API
  const responseText = await response.text();
  let parsedJson;
  
  // Attempt to parse the text as JSON, suppressing syntax errors
  try {
    parsedJson = JSON.parse(responseText);
  } catch {
    parsedJson = null; // Set to null if the response is not valid JSON
  }
  
  // Throw a formatted error if the HTTP status is not OK (2xx)
  if (!response.ok)
    throw new Error(
      `HTTP ${response.status}: ${(parsedJson && (parsedJson.error?.message || parsedJson.message)) || responseText.slice(0, 300)}`,
    );
    
  // Return the successfully parsed JSON body
  return parsedJson;
}
/**
 * IPC Handler: 'llm:complete'
 * Called by the renderer process to generate a response from an LLM.
 * Routes the request to the currently selected AI provider using its respective API schema.
 */
ipcMain.handle("llm:complete", async (event, { system, user }) => {
  // Load config, active provider, specific settings, and decrypted API key
  const config = loadConfig(),
    provider = config.provider,
    providerSettings = config[provider],
    apiKey = decryptText(providerSettings.key);
    
  // Special Handling for Anthropic Claude (Uses specific Anthropic API format)
  if (provider === "claude") {
    // Require a key for Anthropic calls
    if (!apiKey) throw new Error("No Anthropic API key set (Settings).");
    
    // Call the Anthropic /messages endpoint
    const responseJson = await post(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      {
        model: providerSettings.model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      },
    );
    
    // Parse the Anthropic response and join text blocks
    return {
      text: responseJson.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n"),
    };
  }
  
  // Section: OpenAI Compatibility Layer
  // GitHub Copilot (GitHub Models), Custom, OpenRouter, and Gemini speak the standard OpenAI chat-completions format.
  
  // Validate presence of required API keys for specific providers
  if (provider === "copilot" && !apiKey)
    throw new Error("No GitHub token set (Settings).");
  if (provider === "openrouter" && !apiKey)
    throw new Error("No OpenRouter API key set (Settings).");
  if (provider === "gemini" && !apiKey)
    throw new Error("No Gemini API key set (Settings).");
    
  // Construct authorization headers if an API key is available
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  
  // Attach Copilot specific HTTP headers
  if (provider === "copilot")
    Object.assign(headers, {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    });

  // Attach OpenRouter specific headers for analytics and app identification
  if (provider === "openrouter")
    Object.assign(headers, {
      "HTTP-Referer": "qa-agent",
      "X-Title": "qa-agent-desktop",
    });
    
  // Post the request to the provider's /chat/completions endpoint
  const responseJson = await post(
    providerSettings.baseUrl.replace(/\/$/, "") + "/chat/completions",
    headers,
    {
      model: providerSettings.model,
      // Map system and user messages into the OpenAI array structure
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
  );
  
  // Extract and return the first generated text content choice
  return { text: responseJson.choices?.[0]?.message?.content || "" };
});

/**
 * IPC Handler: 'file:save'
 * Prompts the user with a native file-save dialog to write generated content to disk.
 */
ipcMain.handle("file:save", async (event, name, text) => {
  // Show system save dialog with a default provided filename
  const dialogResult = await dialog.showSaveDialog({ defaultPath: name });
  
  // Abort saving if the user canceled the dialog prompt
  if (dialogResult.canceled) return false;
  
  // Synchronously write the text contents to the user-selected file path
  fs.writeFileSync(dialogResult.filePath, text);
  return true;
});

/**
 * App Event: 'ready'
 * Fired when Electron has finished initialization and is ready to create browser windows.
 * This is where we create the primary application window and load the UI.
 */
app.whenReady().then(() => {
  // Configure the main browser window properties
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 820,
    webPreferences: {
      // Load bridge script to safely expose specific Node functionality to the frontend
      preload: path.join(__dirname, "preload.js"),
      // Secure IPC: ensures renderer can't access electron internals
      contextIsolation: true,
      // Prevent raw Node APIs from being used in frontend scripts
      nodeIntegration: false,
      // Enable Chromium sandbox for security
      sandbox: true,
    },
  });
  
  // Hide the native OS menu bar for a cleaner UI look
  mainWindow.setMenuBarVisibility(false);
  
  // Intercept any attempts to open new windows or links within the app
  // and redirect them to the user's default OS browser instead.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  
  // Load the primary HTML view template
  mainWindow.loadFile("index.html");
});

/**
 * App Event: 'window-all-closed'
 * Quits the application when all windows are closed, 
 * maintaining typical desktop application behavior.
 */
app.on("window-all-closed", () => app.quit());
