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
            .filter(([_, answerData]) => {
                // Support both old format (string) and new format (object with answer/category)
                const answer = typeof answerData === 'string' ? answerData : answerData?.answer;
                return answer && answer.trim();
            })
            .map(([question, answerData]) => {
                const answer = typeof answerData === 'string' ? answerData : answerData.answer;
                return `Q: ${question}\nA: ${answer}`;
            })
            .join('\n\n');

        if (answersText) {
            fullPrompt = `Original prompt:\n${prompt}\n\nContext from previous questions:\n${answersText}`;
        }
    }

    const systemPrompt = `You are an intelligent prompt quality analyzer. Your goal is to identify the most CRITICAL gaps that would block someone from understanding or implementing this prompt.

ADAPTIVE QUESTIONING APPROACH:

Golden Rule: "Would a colleague with minimal context understand this prompt and be able to act on it?"

ANALYZE THE PROMPT:
Identify what's missing by considering these areas (but don't ask about all — only what's critically unclear):
- Clarity: Are there ambiguous terms? Would someone unfamiliar with the context understand?
- Context: Who is this for? Why does it matter? What's the background or motivation?
- Scope: What specifically needs to be done? What are the actual requirements?
- Constraints: What should be avoided? What are the limitations (time, budget, technical)?

QUESTION GENERATION RULES:
1. Generate 2-4 questions maximum (focus on highest impact gaps)
2. Prioritize by impact — most critical questions first
3. Each question asks about ONE thing only (no compound questions)
4. Skip questions where the answer is obvious from context
5. Include a brief explanation of WHY each question matters
6. Provide 3-4 example answers as suggestions for each question

EXAMPLE OPTION FORMAT:
- Use pipe '|' to separate options, NOT commas
- Each option must be complete and self-contained
- For numbers, write without commas (use "5000" not "5,000")
- Examples: "Static website | Blog with CMS | E-commerce store | SaaS application"
- Examples: "Under $500 | $500 to $2000 | $2000 to $5000 | Above $5000"

QUALITY SCORE GUIDELINES:
- 8-10: Prompt is clear enough to start building
- 5-7: Some important details missing
- 1-4: Critical information missing that would block implementation

IMPROVED PROMPT RULES:
- If this is FIRST analysis (no "Context from previous questions:"): set "improvedPrompt" to null
- If context exists: Generate an improved prompt incorporating ALL answers
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
      "explanation": "Why this matters for implementation",
      "example": "Option 1 | Option 2 | Option 3 | Option 4",
      "category": "clarity|scope|context",
      "suggestions": [
        {
          "option": "Specific choice",
          "explanation": "Detailed pros/cons/implications",
          "recommended": true
        }
      ]
    }
  ],
  "riskLevel": "low|medium|high",
  "summary": "What is clear + what critical gaps remain",
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

            /**
             * Split text by commas, but ignore commas inside parentheses
             */
            function splitByCommasRespectingParentheses(text) {
                let protected = text.replace(/\(([^)]+)\)/g, (match) => match.replace(/,/g, '{{COMMA}}'));
                let parts = protected.split(',').map(p => p.trim());
                return parts.map(p => p.replace(/\{\{COMMA\}\}/g, ','));
            }

            // Generate improved prompt in JavaScript if we have previous answers
            if (previousAnswers && Object.keys(previousAnswers).length > 0) {
                const answers = Object.entries(previousAnswers)
                    .filter(([question, answerData]) => {
                        // Support both old format (string) and new format (object with answer/category)
                        const answer = typeof answerData === 'string' ? answerData : answerData?.answer;
                        return answer && answer.trim();
                    })
                    .map(([question, answerData]) => ({
                        question: question.toLowerCase(),
                        answer: typeof answerData === 'string' ? answerData : answerData.answer,
                        category: typeof answerData === 'object' ? (answerData.category || 'general') : 'general'
                    }));

                if (answers.length > 0) {
                    // Categorize answers using Sonnet's category tags
                    let purpose = null, audience = null;
                    const features = [], data = [], auth = [], integrations = [];
                    const timeline = [], budget = [], techStack = [], deliverable = [], exclusions = [];

                    // Process and filter answers to exclude unhelpful responses
                    function processAnswer(answer) {
                        if (!answer || typeof answer !== 'string') return null;

                        const trimmed = answer.trim();
                        const lower = trimmed.toLowerCase();

                        // Skip non-informative answers
                        if (['no', 'n/a', 'none', 'not applicable', 'no preference', 'not sure'].includes(lower)) {
                            return null;
                        }

                        // Transform "Yes for X" or "Yes, X" patterns
                        if (lower.startsWith('yes')) {
                            // Remove "yes" and common separators, keep the meaningful part
                            const detail = trimmed.replace(/^yes[,\s]*(for|but|and|with|to)?\s*/i, '').trim();
                            return detail || null;
                        }

                        return trimmed;
                    }

                    answers.forEach(a => {
                        const q = a.question;
                        const ans = a.answer;
                        const category = a.category ? a.category.toLowerCase() : 'general';

                        // Check for PURPOSE first (regardless of category)
                        if (q.includes('type') || q.includes('kind') || q.includes('purpose') || q.includes('goal') || q.includes('what are you building')) {
                            if (!purpose) purpose = ans;
                        }
                        // Check for AUDIENCE second (regardless of category)
                        else if (q.includes('audience') || q.includes('who') || q.includes('users') || q.includes('target') || q.includes('customers') || q.includes('clients')) {
                            if (!audience) audience = ans;
                        }
                        // SCOPE category → Requirements (features, integrations, technical details)
                        else if (category === 'scope') {
                            // Check for specific subcategories
                            if (q.includes('data') || q.includes('storage') || q.includes('database') || q.includes('store')) {
                                const processed = processAnswer(ans);
                                if (processed) data.push(processed);
                            } else if (q.includes('authentication') || q.includes('login') || q.includes('user account') || q.includes('sign up')) {
                                const processed = processAnswer(ans);
                                if (processed) auth.push(processed);
                            } else if (q.includes('integration') || q.includes('connect') || q.includes('api') || q.includes('third-party')) {
                                const processed = processAnswer(ans);
                                if (processed) integrations.push(processed);
                            } else if (q.includes('deliverable') || q.includes('output') || q.includes('receive') || q.includes('end result')) {
                                const processed = processAnswer(ans);
                                if (processed) deliverable.push(processed);
                            } else if (q.includes('exclude') || q.includes('out of scope') || q.includes('not include') || q.includes('skip')) {
                                const processed = processAnswer(ans);
                                if (processed) exclusions.push(processed);
                            } else {
                                // Default scope questions to features
                                const processed = processAnswer(ans);
                                if (processed) features.push(processed);
                            }
                        }
                        // CONTEXT category → Constraints & Technical Context
                        else if (category === 'context') {
                            if (q.includes('timeline') || q.includes('deadline') || q.includes('when') || q.includes('how long')) {
                                const processed = processAnswer(ans);
                                if (processed) timeline.push(processed);
                            } else if (q.includes('budget') || q.includes('cost') || q.includes('price') || q.includes('spend')) {
                                const processed = processAnswer(ans);
                                if (processed) budget.push(processed);
                            } else if (q.includes('technology') || q.includes('framework') || q.includes('language') || q.includes('stack') || q.includes('built with') || q.includes('skill level') || q.includes('experience') || q.includes('who is building')) {
                                const processed = processAnswer(ans);
                                if (processed) techStack.push(processed);
                            } else {
                                // Other context questions go to constraints
                                const processed = processAnswer(ans);
                                if (processed) budget.push(processed);
                            }
                        }
                        // SAFETY, COMPLETENESS, CLARITY, or GENERAL → Use keyword fallback
                        else {
                            if (q.includes('deliverable') || q.includes('output') || q.includes('receive') || q.includes('end result')) {
                                const processed = processAnswer(ans);
                                if (processed) deliverable.push(processed);
                            } else if (q.includes('exclude') || q.includes('out of scope') || q.includes('not include') || q.includes('skip')) {
                                const processed = processAnswer(ans);
                                if (processed) exclusions.push(processed);
                            } else {
                                // Default to features
                                const processed = processAnswer(ans);
                                if (processed) features.push(processed);
                            }
                        }
                    });

                    // Build natural opening sentence
                    let opening = '';
                    if (purpose) {
                        opening = `Build a ${purpose}`;
                        if (audience) {
                            opening += ` for ${audience}`;
                        }
                        opening += '.';
                    } else {
                        // Use first sentence from original prompt as fallback
                        if (prompt && prompt.trim()) {
                            const firstSentence = prompt.split('.')[0];
                            opening = firstSentence + '.';
                        } else {
                            opening = 'Implement the following requirements:';
                        }
                    }

                    // Build XML-wrapped sections
                    const xmlSections = [];

                    // Add context (always included)
                    xmlSections.push('<context>');
                    let contextText = '';
                    if (purpose && audience) {
                        contextText = `Building a ${purpose} for ${audience}.`;
                    } else if (purpose) {
                        contextText = `Building a ${purpose}.`;
                    } else if (audience) {
                        contextText = `Developing a solution for ${audience}.`;
                    } else if (prompt && prompt.trim()) {
                        // Use original prompt as context fallback
                        contextText = prompt;
                    } else {
                        contextText = 'Building a custom solution based on the specified requirements.';
                    }
                    xmlSections.push(contextText);
                    xmlSections.push('</context>');
                    xmlSections.push('');

                    // Add task (always included)
                    xmlSections.push('<task>');
                    xmlSections.push(opening);
                    xmlSections.push('</task>');
                    xmlSections.push('');

                    // Add requirements section (only if content exists)
                    const requirements = [...features, ...integrations, ...auth, ...data];
                    if (requirements.length > 0) {
                        xmlSections.push('<requirements>');
                        requirements.forEach(req => {
                            const items = req.includes(',')
                                ? splitByCommasRespectingParentheses(req)
                                : [req];
                            items.forEach(item => xmlSections.push('- ' + item));
                        });
                        xmlSections.push('</requirements>');
                        xmlSections.push('');
                    }

                    // Add constraints section (only if content exists)
                    const constraints = [...timeline, ...budget];
                    if (constraints.length > 0) {
                        xmlSections.push('<constraints>');
                        if (timeline.length > 0) {
                            xmlSections.push('- Timeline: ' + timeline.join(', '));
                        }
                        if (budget.length > 0) {
                            xmlSections.push('- Budget: ' + budget.join(', '));
                        }
                        xmlSections.push('</constraints>');
                        xmlSections.push('');
                    }

                    // Add technical context (if any) - keep as plain text for now
                    if (techStack.length > 0) {
                        xmlSections.push('Technical Context:');
                        techStack.forEach(tech => xmlSections.push('- ' + tech));
                        xmlSections.push('');
                    }

                    // Add output specification (always included)
                    xmlSections.push('<output_specification>');
                    if (deliverable.length > 0) {
                        deliverable.forEach(del => xmlSections.push('- ' + del));
                    } else {
                        xmlSections.push('- Working application with setup instructions');
                        xmlSections.push('- README with deployment guide');
                    }
                    xmlSections.push('</output_specification>');

                    // Add scope boundaries (only if content exists)
                    if (exclusions.length > 0) {
                        xmlSections.push('');
                        xmlSections.push('<scope_boundaries>');
                        exclusions.forEach(exc => {
                            const items = exc.includes(',')
                                ? splitByCommasRespectingParentheses(exc)
                                : [exc];
                            items.forEach(item => xmlSections.push('- ' + item));
                        });
                        xmlSections.push('</scope_boundaries>');
                    }

                    // Override Sonnet's improvedPrompt
                    analysisData.improvedPrompt = xmlSections.join('\n');
                    console.log('[Background Script] Generated improved prompt from', answers.length, 'answers');
                }
            }

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
