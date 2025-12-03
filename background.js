// Background script to handle API calls
// This is necessary because Firefox requires API calls with host_permissions
// to be made from a background context, not from popup scripts

// Token tracking state
let sessionInputTokens = 0;
let sessionOutputTokens = 0;

// Provider configurations
const PROVIDERS = {
    anthropic: {
        name: 'Anthropic',
        baseUrl: 'https://api.anthropic.com/v1/messages',
        defaultModel: 'claude-sonnet-4-5-20250929'
    },
    openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        defaultModel: 'gpt-4'
    },
    google: {
        name: 'Google Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        defaultModel: 'gemini-pro'
    }
};

// Storage keys for settings
const STORAGE_KEYS = {
    PROVIDER: 'provider',
    MODEL: 'model',
    API_KEY: 'apiKey',
    LEGACY_API_KEY: 'anthropicApiKey'
};

console.log('[Background Script] Loaded and ready');

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background Script] Received message:', message.type);

    if (message.type === 'ANALYZE_PROMPT') {
        console.log('[Background Script] Analyzing prompt...');
        // Make the API call
        analyzePrompt(message.apiKey, message.prompt, message.previousAnswers)
            .then(result => {
                console.log('[Background Script] Analysis successful');
                sendResponse({ success: true, data: result });
            })
            .catch(error => {
                console.error('[Background Script] Analysis failed:', error);
                sendResponse({ success: false, error: error.message, status: error.status });
            });

        // Return true to indicate we'll send a response asynchronously
        return true;
    }

    if (message.type === 'TEST_API_KEY') {
        console.log('[Background Script] Testing API key with model:', message.model);
        // Test the API key with the selected model
        testAPIKey(message.apiKey, message.model)
            .then(result => {
                console.log('[Background Script] API key test successful');
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error('[Background Script] API key test failed:', error);
                sendResponse({ success: false, error: error.message, status: error.status });
            });

        return true;
    }

    if (message.type === 'RESET_TOKEN_USAGE') {
        console.log('[Background Script] Resetting token usage...');
        sessionInputTokens = 0;
        sessionOutputTokens = 0;
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'GET_TOKEN_USAGE') {
        console.log('[Background Script] Getting token usage...');

        // Load settings to get current model for cost calculation
        loadProviderSettings()
            .then(settings => {
                const cost = calculateCost(settings.model, sessionInputTokens, sessionOutputTokens);
                sendResponse({
                    success: true,
                    inputTokens: sessionInputTokens,
                    outputTokens: sessionOutputTokens,
                    totalTokens: sessionInputTokens + sessionOutputTokens,
                    cost: cost
                });
            })
            .catch(error => {
                // Fallback to default model if settings load fails
                const cost = calculateCost('claude-sonnet-4-5-20250929', sessionInputTokens, sessionOutputTokens);
                sendResponse({
                    success: true,
                    inputTokens: sessionInputTokens,
                    outputTokens: sessionOutputTokens,
                    totalTokens: sessionInputTokens + sessionOutputTokens,
                    cost: cost
                });
            });

        return true;
    }
});

// ===================================
// PROVIDER ABSTRACTION LAYER
// ===================================

/**
 * Load provider settings from storage with fallbacks
 */
async function loadProviderSettings() {
    const result = await browser.storage.local.get([
        STORAGE_KEYS.PROVIDER,
        STORAGE_KEYS.MODEL,
        STORAGE_KEYS.API_KEY,
        STORAGE_KEYS.LEGACY_API_KEY
    ]);

    const provider = result[STORAGE_KEYS.PROVIDER] || 'anthropic';
    const model = result[STORAGE_KEYS.MODEL] || PROVIDERS[provider].defaultModel;
    const apiKey = result[STORAGE_KEYS.API_KEY] || result[STORAGE_KEYS.LEGACY_API_KEY];

    if (!apiKey) {
        throw new Error('No API key found. Please configure your API key in settings.');
    }

    console.log(`[Provider] Loaded settings - Provider: ${provider}, Model: ${model}`);
    return { provider, model, apiKey };
}

/**
 * Route API call to the correct provider with unified error handling
 */
async function callProvider(provider, model, apiKey, systemPrompt, userMessage) {
    console.log(`[Provider] Routing to ${provider} with model ${model}`);

    try {
        switch (provider) {
            case 'anthropic':
                return await callAnthropic(model, apiKey, systemPrompt, userMessage);
            case 'openai':
                return await callOpenAI(model, apiKey, systemPrompt, userMessage);
            case 'google':
                return await callGoogle(model, apiKey, systemPrompt, userMessage);
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    } catch (error) {
        console.error(`[Provider] ${provider} error:`, error);

        if (error.message.includes('coming soon')) {
            throw error;
        }

        const friendlyMessage = error.status
            ? `${PROVIDERS[provider].name} API error: ${error.message}`
            : `Failed to connect to ${PROVIDERS[provider].name}: ${error.message}`;

        const friendlyError = new Error(friendlyMessage);
        friendlyError.status = error.status;
        throw friendlyError;
    }
}

/**
 * Call Anthropic API
 */
async function callAnthropic(model, apiKey, systemPrompt, userMessage) {
    const response = await fetch(PROVIDERS.anthropic.baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 4096,
            messages: [{
                role: 'user',
                content: userMessage
            }]
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(getErrorMessage(response.status, errorData));
        error.status = response.status;
        throw error;
    }

    const data = await response.json();

    return {
        content: data.content && data.content.length > 0 ? data.content[0].text : null,
        usage: {
            inputTokens: data.usage?.input_tokens || 0,
            outputTokens: data.usage?.output_tokens || 0
        },
        stopReason: data.stop_reason,
        model: model,
        raw: data
    };
}

/**
 * Call OpenAI API (placeholder)
 */
async function callOpenAI(model, apiKey, systemPrompt, userMessage) {
    throw new Error('OpenAI support is coming soon. Please use Anthropic (Claude) for now.');
}

/**
 * Call Google Gemini API (placeholder)
 */
async function callGoogle(model, apiKey, systemPrompt, userMessage) {
    throw new Error('Google Gemini support is coming soon. Please use Anthropic (Claude) for now.');
}

// ===================================
// MAIN ANALYSIS FUNCTION
// ===================================

async function analyzePrompt(apiKey, prompt, previousAnswers = {}) {
    // Load provider settings
    const settings = await loadProviderSettings();
    console.log('[Background Script] Using provider:', settings.provider, 'with model:', settings.model);

    // Build the prompt with context if there are previous answers
    let fullPrompt = prompt;
    if (previousAnswers && Object.keys(previousAnswers).length > 0) {
        const answersText = Object.entries(previousAnswers)
            .filter(([_, answer]) => answer && answer.trim())
            .map(([id, answer]) => `Q${id}: ${answer}`)
            .join('\n');

        if (answersText) {
            fullPrompt = `Original prompt:\n${prompt}\n\nContext from previous questions:\n${answersText}`;
        }
    }

    const systemPrompt = `You are an intelligent prompt quality analyzer focused on identifying CRITICAL technical gaps that would block implementation.

PHASE-BASED QUESTIONING LOGIC:

STEP 1: DETERMINE CURRENT PHASE
- If NO "Context from previous questions:" section exists → You are in PHASE 1
- If context exists → Analyze the answers to determine which phase is complete and ask the NEXT phase

PHASE DEFINITIONS:

PHASE 1 - FOUNDATION (Ask FIRST, always, 2-3 questions max):
Questions about:
- Application type/purpose (What kind of app? Website, SaaS, mobile, API, etc.)
- Target audience (Who will use this?)
These fundamentally shape ALL other decisions. Do not ask about features, tech stack, or implementation until these are answered.

PHASE 2 - CORE REQUIREMENTS (Ask AFTER Phase 1 is answered, 3-5 questions):
Questions about:
- Core features needed (based on the type from Phase 1)
- Data storage/user accounts needs
- Key integrations required
SKIP irrelevant questions based on Phase 1 answers:
- If type is "static website" or "blog" → Skip questions about user auth, databases, payments
- If type is "internal tool" → Skip questions about public scaling, SEO

PHASE 3 - CONSTRAINTS (Ask AFTER Phase 2 is answered, 2-3 questions):
Questions about:
- Timeline and budget
- Technical skill level / who is building this
- Hosting preferences

PHASE 4 - IMPLEMENTATION DETAILS (Ask LAST, only if earlier phases clear, 2-3 questions):
Questions about:
- Specific tech stack preferences
- Third-party service preferences
- Deployment requirements

CRITICAL RULES:
1. On FIRST analysis (no context): Ask ONLY Phase 1 questions (2-3 questions maximum)
2. Each regeneration: Ask questions from the NEXT appropriate phase only
3. SKIP questions that are irrelevant based on earlier answers
4. Each question must ask about ONE thing only (no compound questions with "and")
5. Maximum 5 questions per round
6. In the "explanation" field, reference what you already know from previous answers

EXAMPLE OPTION FORMAT:
- Use pipe '|' to separate options, NOT commas
- Each option must be complete and self-contained
- For numbers, write without commas (use "5000" not "5,000")
- Examples: "Static website | Blog with CMS | E-commerce store | SaaS application | Mobile app"
- Examples: "Under $500 | $500 to $2000 | $2000 to $5000 | Above $5000"

QUALITY SCORE GUIDELINES:
- 8-10: Prompt is clear enough to start building
- 5-7: Some important technical details missing
- 1-4: Critical information missing

IMPROVED PROMPT RULES:
- If this is FIRST analysis (no previous answers): set "improvedPrompt" to null
- If "Context from previous questions:" exists: Generate an improved prompt incorporating ALL answers
  - Write it as if the user wrote it themselves
  - Use clear, specific language
  - Group into logical sections (Requirements, Constraints, Technical Details)
  - Do NOT include Q&A format or placeholders

Return JSON in this EXACT structure:
{
  "questions": [
    {
      "id": 1,
      "question": "Your question (ONE thing only)",
      "explanation": "Why this matters, referencing what you already know",
      "example": "Option 1 | Option 2 | Option 3 | Option 4",
      "category": "clarity|scope|context|safety|completeness",
      "suggestions": [
        {
          "option": "Specific choice",
          "explanation": "Detailed pros/cons",
          "recommended": true
        }
      ]
    }
  ],
  "riskLevel": "low|medium|high",
  "summary": "What is clear + what gaps remain",
  "qualityScore": 1-10,
  "improvedPrompt": null or "Enhanced prompt with ALL answers"
}

IMPORTANT: Return ONLY valid JSON, no additional text.`;

    const userMessage = `${systemPrompt}\n\nPrompt to analyze:\n${fullPrompt}`;
    console.log('[Background Script] Full prompt sent to AI');

    // Call the appropriate provider
    const providerResponse = await callProvider(
        settings.provider,
        settings.model,
        settings.apiKey,
        systemPrompt,
        userMessage
    );

    // Update token usage from unified response
    sessionInputTokens += providerResponse.usage.inputTokens;
    sessionOutputTokens += providerResponse.usage.outputTokens;
    console.log('[Background Script] Token usage - Input:', providerResponse.usage.inputTokens, 'Output:', providerResponse.usage.outputTokens);
    console.log('[Background Script] Session totals - Input:', sessionInputTokens, 'Output:', sessionOutputTokens);

    // Check if response was truncated
    if (providerResponse.stopReason === 'max_tokens') {
        console.warn('[Background Script] Response was truncated due to max_tokens limit');
    }

    if (providerResponse.content) {
        let responseText = providerResponse.content;

        // Claude sometimes wraps JSON in markdown code blocks, so extract it
        const jsonBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (jsonBlockMatch) {
            responseText = jsonBlockMatch[1].trim();
            console.log('[Background Script] Extracted JSON from markdown code block');
        }

        // Try to parse JSON response
        try {
            const analysisData = JSON.parse(responseText);

            // Add token usage data to the response
            const totalTokens = sessionInputTokens + sessionOutputTokens;
            const cost = calculateCost(providerResponse.model, sessionInputTokens, sessionOutputTokens);

            return {
                ...analysisData,
                tokenUsage: {
                    inputTokens: sessionInputTokens,
                    outputTokens: sessionOutputTokens,
                    totalTokens: totalTokens,
                    cost: cost
                }
            };
        } catch (parseError) {
            console.error('[Background Script] Failed to parse JSON:', responseText);
            console.error('[Background Script] Parse error details:', parseError.message);
            console.error('[Background Script] First 500 chars of response:', responseText.substring(0, 500));
            throw new Error('Received invalid JSON from AI. Please try again.');
        }
    } else {
        throw new Error('Received empty response from AI provider');
    }
}

async function testAPIKey(apiKey, model = 'claude-sonnet-4-5-20250929') {
    const trimmedKey = apiKey.trim();

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.anthropic.com/v1/messages');

        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('x-api-key', trimmedKey);
        xhr.setRequestHeader('anthropic-version', '2023-06-01');
        xhr.setRequestHeader('anthropic-dangerous-direct-browser-access', 'true');

        xhr.onload = function () {
            if (xhr.status === 200) {
                resolve(true);
            } else {
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    const error = new Error(getErrorMessage(xhr.status, errorData));
                    error.status = xhr.status;
                    reject(error);
                } catch (e) {
                    const error = new Error(getErrorMessage(xhr.status, {}));
                    error.status = xhr.status;
                    reject(error);
                }
            }
        };

        xhr.onerror = function () {
            reject(new Error('Network error'));
        };

        xhr.send(JSON.stringify({
            model: model,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
        }));
    });
}

function calculateCost(model, inputTokens, outputTokens) {
    const rates = {
        'claude-haiku-4-5-20251001': { input: 1, output: 5 },
        'claude-sonnet-4-5-20250929': { input: 3, output: 15 },
        'claude-sonnet-4-5-20251001': { input: 3, output: 15 },
        'claude-opus-4-5-20251001': { input: 15, output: 75 }
    };

    const rate = rates[model] || rates['claude-sonnet-4-5-20250929'];

    const inputCost = (inputTokens / 1_000_000) * rate.input;
    const outputCost = (outputTokens / 1_000_000) * rate.output;

    return inputCost + outputCost;
}

function getErrorMessage(status, errorData) {
    if (status === 401) {
        return 'Invalid API key';
    } else if (status === 429) {
        return 'Rate limit exceeded';
    } else if (status === 400) {
        return errorData.error?.message || 'Bad request';
    } else if (status >= 500) {
        return 'Anthropic server error';
    } else if (errorData.error && errorData.error.message) {
        return errorData.error.message;
    }
    return 'API request failed';
}
