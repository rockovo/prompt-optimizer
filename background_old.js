// Background script to handle API calls
// This is necessary because Firefox requires API calls with host_permissions
// to be made from a background context, not from popup scripts

// Token tracking state
let sessionInputTokens = 0;
let sessionOutputTokens = 0;

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
        console.log('[Background Script] Testing API key...');
        // Test the API key
        testAPIKey(message.apiKey)
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
        const cost = calculateCost('claude-haiku-4-5-20251001', sessionInputTokens, sessionOutputTokens);
        sendResponse({
            success: true,
            inputTokens: sessionInputTokens,
            outputTokens: sessionOutputTokens,
            totalTokens: sessionInputTokens + sessionOutputTokens,
            cost: cost
        });
        return true;
    }
});

async function analyzePrompt(apiKey, prompt, previousAnswers = {}) {
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

STEP 1: PARSE what the user has ALREADY specified
Carefully read the prompt and extract:
- What technologies/frameworks they mentioned
- What features they described
- What design direction they indicated
- What content they mentioned

DO NOT ask questions about things they've already told you!

STEP 2: CATEGORIZE remaining gaps
A) CRITICAL TECHNICAL GAPS (MUST ask):
   - Technical ambiguities affecting architecture
   - Security/data concerns
   - Integration specifics not specified
   - Technical constraints that change implementation

B) BUSINESS/MARKETING DETAILS (SKIP):
   - Exact pricing amounts, copy text, marketing strategy

C) DESIGN/AESTHETIC PREFERENCES (SKIP unless truly ambiguous):
   - Exact colors, fonts, UI layout micro-decisions

STEP 3: ONLY ask about CRITICAL TECHNICAL GAPS

CRITICAL RULE - ONE QUESTION PER CARD:
- Each question must ask about ONE thing only
- DO NOT combine multiple questions with "and"
- Bad: "Who is the target audience and what devices will they use?"
- Good: Split into two cards:
  1. "Who is the target audience?" (profession, lifestyle, use case)
  2. "What devices will they primarily use?" (mobile vs desktop)
- If you need to know 2+ things, create 2+ separate question cards
- Each question should have a single clear answer

QUALITY SCORE GUIDELINES:
- 8-10: Prompt is clear enough to start building
- 5-7: Some important technical details missing
- 1-4: Critical information missing

IMPROVED PROMPT RULES:
- If this is FIRST analysis (no previous answers): set "improvedPrompt" to null
- ONLY generate "improvedPrompt" when REGENERATING with user answers
- When regenerating: ALWAYS create improved prompt incorporating ALL answers

WHEN REGENERATING (previous answers provided):
- Acknowledge answers provided
- ALWAYS generate an improved prompt incorporating answers
- Check each answer for uncertainty like "I don't know", "not sure", "what would you recommend?"
- For uncertain answers: provide 2-3 concrete SUGGESTIONS with detailed explanations
- Mark ONE suggestion as "recommended: true"
- For clear answers: incorporate and move to new questions

HANDLING UNCERTAIN ANSWERS:
When user expresses uncertainty, provide 2-3 options in "suggestions" array:
- Each suggestion should be a viable concrete choice
- Include detailed pros/cons explanation
- Mark ONE as "recommended: true"
- Limit to max 3; provide fewer if not enough genuine options

Return JSON in this EXACT structure:
{
  "questions": [
    {
      "id": 1,
      "question": "Your question (ONE thing only, no 'and')",
      "explanation": "Why this is a blocker",
      "example": "Example decision needed",
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
  "improvedPrompt": null (if first analysis) OR "Enhanced prompt with ALL answers" (if regenerating)
}

IMPORTANT: Return ONLY valid JSON, no additional text.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2048,
            messages: [{
                role: 'user',
                content: `${systemPrompt}\n\nPrompt to analyze:\n${fullPrompt}`
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

    // Extract token usage from response
    if (data.usage) {
        const inputTokens = data.usage.input_tokens || 0;
        const outputTokens = data.usage.output_tokens || 0;

        sessionInputTokens += inputTokens;
        sessionOutputTokens += outputTokens;

        console.log('[Background Script] Token usage - Input:', inputTokens, 'Output:', outputTokens);
        console.log('[Background Script] Session totals - Input:', sessionInputTokens, 'Output:', sessionOutputTokens);
    }

    if (data.content && data.content.length > 0) {
        let responseText = data.content[0].text;

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
            const cost = calculateCost('claude-haiku-4-5-20251001', sessionInputTokens, sessionOutputTokens);

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
            throw new Error('Received invalid JSON from Claude. Please try again.');
        }
    } else {
        throw new Error('Received empty response from Claude');
    }
}

async function testAPIKey(apiKey) {
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
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
        }));
    });
}

function calculateCost(model, inputTokens, outputTokens) {
    const rates = {
        'claude-haiku-4-5-20251001': { input: 1, output: 5 },
        'claude-sonnet-4-5-20251001': { input: 3, output: 15 },
        'claude-opus-4-5-20251001': { input: 15, output: 75 }
    };

    const rate = rates[model] || rates['claude-haiku-4-5-20251001'];

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
