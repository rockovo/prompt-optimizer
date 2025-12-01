// Get references to DOM elements
const apiKeyInput = document.getElementById('apiKey');
const toggleBtn = document.getElementById('toggleVisibility');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const messageDiv = document.getElementById('message');

// Load saved API key on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const result = await browser.storage.local.get('anthropicApiKey');
        if (result.anthropicApiKey) {
            apiKeyInput.value = result.anthropicApiKey;
        }
    } catch (error) {
        showMessage('Error loading saved API key', 'error');
    }
});

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

// Save API key
saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        showMessage('Please enter an API key', 'error');
        return;
    }

    // Basic format validation
    if (!apiKey.startsWith('sk-ant-')) {
        showMessage('API key should start with "sk-ant-"', 'error');
        return;
    }

    try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        await browser.storage.local.set({ anthropicApiKey: apiKey });

        showMessage('API key saved successfully!', 'success');
        saveBtn.textContent = 'Saved!';

        setTimeout(() => {
            saveBtn.textContent = 'Save API Key';
            saveBtn.disabled = false;
        }, 2000);
    } catch (error) {
        showMessage('Error saving API key: ' + error.message, 'error');
        saveBtn.textContent = 'Save API Key';
        saveBtn.disabled = false;
    }
});

// Test API key
testBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        showMessage('Please enter an API key first', 'error');
        return;
    }

    try {
        testBtn.disabled = true;
        saveBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        showMessage('Testing API key...', 'info');

        console.log('[Options] Sending TEST_API_KEY message to background script...');

        // Send message to background script to test the API key
        const response = await browser.runtime.sendMessage({
            type: 'TEST_API_KEY',
            apiKey: apiKey
        });

        console.log('[Options] Received response from background:', response);

        if (response.success) {
            showMessage('✓ API key is valid and working!', 'success');
            testBtn.textContent = 'Test Successful!';
        } else {
            let errorMessage = response.error || 'API key test failed';

            if (response.status === 401) {
                errorMessage = 'Invalid API key. Please check your key.';
            } else if (response.status === 429) {
                errorMessage = 'Rate limit exceeded. Please try again later.';
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
