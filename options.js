// Provider configuration
const PROVIDERS = {
    anthropic: {
        name: 'Anthropic',
        keyPrefix: 'sk-ant-',
        helpText: 'To use Claude for prompt optimization, you need an API key from Anthropic.',
        linkUrl: 'https://console.anthropic.com/',
        models: {
            'claude-sonnet-4-5-20250929': {
                name: 'Sonnet 4.5',
                description: 'Best quality',
                cost: '~$0.02 per analysis',
                recommended: true
            },
            'claude-haiku-4-5-20251001': {
                name: 'Haiku 4.5',
                description: 'Budget option',
                cost: '~$0.002 per analysis',
                recommended: false
            }
        },
        defaultModel: 'claude-sonnet-4-5-20250929'
    },
    openai: {
        name: 'OpenAI',
        disabled: true
    },
    google: {
        name: 'Google Gemini',
        disabled: true
    }
};

// Get references to DOM elements
const providerSelect = document.getElementById('provider');
const modelSelect = document.getElementById('model');
const modelInfo = document.getElementById('modelInfo');
const apiKeyInput = document.getElementById('apiKey');
const toggleBtn = document.getElementById('toggleVisibility');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const messageDiv = document.getElementById('message');
const aboutText = document.getElementById('aboutText');

// Populate model dropdown based on selected provider
function populateModels(provider) {
    const providerData = PROVIDERS[provider];

    // Clear existing options
    modelSelect.innerHTML = '';

    // Add model options
    Object.entries(providerData.models).forEach(([value, data]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = `${data.name}${data.recommended ? ' (Recommended)' : ''} - ${data.description}`;
        option.dataset.cost = data.cost;
        option.dataset.name = data.name;
        modelSelect.appendChild(option);
    });

    // Update model info
    updateModelInfo();
}

// Update model cost/description display
function updateModelInfo() {
    const selectedOption = modelSelect.options[modelSelect.selectedIndex];

    if (selectedOption) {
        modelInfo.textContent = selectedOption.dataset.cost;
        updateAboutText();
    }
}

// Update API key section labels and links
function updateApiKeySection(provider) {
    const providerData = PROVIDERS[provider];

    document.getElementById('apiKeyLabel').textContent = `${providerData.name} API Key`;
    document.getElementById('apiKeyHelp').textContent = providerData.helpText;
    document.getElementById('apiKeyLink').href = providerData.linkUrl;
}

// Update About section with current model
function updateAboutText() {
    const provider = providerSelect.value;
    const selectedOption = modelSelect.options[modelSelect.selectedIndex];
    const modelName = selectedOption ? selectedOption.dataset.name : 'Claude';

    aboutText.textContent = `This extension uses ${modelName} to help optimize your prompts. Your API key is stored locally in your browser and never shared.`;
}

// Load saved settings on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const result = await browser.storage.local.get(['provider', 'model', 'apiKey', 'anthropicApiKey']);

        // Load provider (default: anthropic)
        const provider = result.provider || 'anthropic';
        providerSelect.value = provider;

        // Populate models for selected provider
        populateModels(provider);

        // Load model (default: provider's default)
        const model = result.model || PROVIDERS[provider].defaultModel;
        modelSelect.value = model;
        updateModelInfo();

        // Update API key section
        updateApiKeySection(provider);

        // Load API key (try new format first, fallback to old)
        const apiKey = result.apiKey || result.anthropicApiKey;
        if (apiKey) {
            apiKeyInput.value = apiKey;
        }
    } catch (error) {
        showMessage('Error loading settings', 'error');
    }
});

// Provider change event
providerSelect.addEventListener('change', (e) => {
    const provider = e.target.value;
    populateModels(provider);
    updateApiKeySection(provider);
});

// Model change event
modelSelect.addEventListener('change', updateModelInfo);

// Toggle password visibility
toggleBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleBtn.textContent = '🙈';
    } else {
        apiKeyInput.type = 'password';
        toggleBtn.textContent = '👁️';
    }
});

// Save settings
saveBtn.addEventListener('click', async () => {
    const provider = providerSelect.value;
    const model = modelSelect.value;
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        showMessage('Please enter an API key', 'error');
        return;
    }

    // Validate API key format
    const providerData = PROVIDERS[provider];
    if (!apiKey.startsWith(providerData.keyPrefix)) {
        showMessage(`API key should start with "${providerData.keyPrefix}"`, 'error');
        return;
    }

    try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        // Save new structure + backward compatibility
        await browser.storage.local.set({
            provider: provider,
            model: model,
            apiKey: apiKey,
            anthropicApiKey: apiKey  // Backward compatibility
        });

        showMessage('Settings saved successfully!', 'success');
        saveBtn.textContent = 'Saved!';

        setTimeout(() => {
            saveBtn.textContent = 'Save Settings';
            saveBtn.disabled = false;
        }, 2000);
    } catch (error) {
        showMessage('Error saving settings: ' + error.message, 'error');
        saveBtn.textContent = 'Save Settings';
        saveBtn.disabled = false;
    }
});

// Test API key with selected model
testBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;

    if (!apiKey) {
        showMessage('Please enter an API key first', 'error');
        return;
    }

    try {
        testBtn.disabled = true;
        saveBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        showMessage('Testing API key with selected model...', 'info');

        console.log('[Options] Sending TEST_API_KEY message to background script...');
        console.log('[Options] Testing with model:', model);

        // Send message to background script to test the API key with selected model
        const response = await browser.runtime.sendMessage({
            type: 'TEST_API_KEY',
            apiKey: apiKey,
            model: model  // Include selected model in test
        });

        console.log('[Options] Received response from background:', response);

        if (response.success) {
            showMessage('✓ API key is valid and model is working!', 'success');
            testBtn.textContent = 'Test Successful!';
        } else {
            let errorMessage = response.error || 'API key test failed';

            if (response.status === 401) {
                errorMessage = 'Invalid API key. Please check your key.';
            } else if (response.status === 429) {
                errorMessage = 'Rate limit exceeded. Please try again later.';
            } else if (response.status === 404) {
                errorMessage = 'Model not found or not accessible with this API key.';
            }

            showMessage('✗ ' + errorMessage, 'error');
            testBtn.textContent = 'Test Failed';
        }

        setTimeout(() => {
            testBtn.textContent = 'Test API Key';
            testBtn.disabled = false;
            saveBtn.disabled = false;
        }, 3000);

    } catch (error) {
        console.error('[Options] Error during test:', error);
        showMessage('✗ Error: ' + error.message, 'error');
        testBtn.textContent = 'Test Failed';

        setTimeout(() => {
            testBtn.textContent = 'Test API Key';
            testBtn.disabled = false;
            saveBtn.disabled = false;
        }, 3000);
    }
});

// Helper function to show messages
function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + type;
}
