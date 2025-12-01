// Get references to DOM elements
const promptInput = document.getElementById('promptInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const clearBtn = document.getElementById('clearBtn');
const openDashboardBtn = document.getElementById('openDashboardBtn');
const settingsBtn = document.getElementById('settingsBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorArea = document.getElementById('errorArea');
const resultsContainer = document.getElementById('resultsContainer');
const summarySection = document.getElementById('summarySection');
const questionsSection = document.getElementById('questionsSection');
const regenerateBtn = document.getElementById('regenerateBtn');
const tokenCount = document.getElementById('tokenCount');
const costAmount = document.getElementById('costAmount');

// State management
let apiKey = null;
let currentPrompt = '';
let currentAnalysis = null;
let userAnswers = {}; // Map of question ID to answer text

// Load API key and restore saved state on popup open
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const result = await browser.storage.local.get([
            'anthropicApiKey',
            'savedPrompt',
            'savedAnalysis',
            'savedAnswers',
            'savedQualityScore'
        ]);

        if (result.anthropicApiKey) {
            apiKey = result.anthropicApiKey;
        } else {
            showError('Please configure your API key in settings');
        }

        // Restore saved prompt text
        if (result.savedPrompt) {
            promptInput.value = result.savedPrompt;
            currentPrompt = result.savedPrompt;
        }

        // Restore saved answers BEFORE rendering (so they can be pre-filled)
        if (result.savedAnswers) {
            userAnswers = result.savedAnswers;
        }

        // Restore saved analysis (this will render the UI with pre-filled answers)
        if (result.savedAnalysis) {
            currentAnalysis = result.savedAnalysis;
            renderAnalysis();
        }

    } catch (error) {
        showError('Error loading data: ' + error.message);
    }
});

// Auto-save prompt input as user types (with debouncing)
let saveTimeout;
promptInput.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            await browser.storage.local.set({ savedPrompt: promptInput.value });
        } catch (error) {
            console.error('Error saving prompt:', error);
        }
    }, 500); // Save 500ms after user stops typing
});

// Settings button handler
settingsBtn.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
});

// Open Dashboard button handler
openDashboardBtn.addEventListener('click', () => {
    browser.tabs.create({ url: 'dashboard.html' });
});

// Clear button handler
clearBtn.addEventListener('click', handleClear);

// Analyze button handler
analyzeBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();

    // Validation
    if (!prompt) {
        showError('Please enter a prompt to analyze');
        return;
    }

    if (!apiKey) {
        showError('Please configure your API key in settings first');
        return;
    }

    // Reset state for new analysis
    currentPrompt = prompt;
    userAnswers = {};

    await analyzePrompt(prompt);
});

// Regenerate button handler
regenerateBtn.addEventListener('click', async () => {
    if (!currentPrompt) {
        showError('No prompt to regenerate. Please enter a prompt first.');
        return;
    }

    // Collect all user answers from textareas
    const answerInputs = document.querySelectorAll('.answer-input');
    answerInputs.forEach(input => {
        const questionId = input.dataset.questionId;
        const answer = input.value.trim();
        if (answer) {
            userAnswers[questionId] = answer;
        }
    });

    await analyzePrompt(currentPrompt, userAnswers);
});

// Main analysis function
async function analyzePrompt(prompt, previousAnswers = {}) {
    // Disable buttons and show loading
    analyzeBtn.disabled = true;
    regenerateBtn.disabled = true;
    loadingIndicator.classList.add('visible');
    errorArea.classList.remove('visible');
    resultsContainer.classList.remove('visible');

    try {
        // Send message to background script to analyze prompt
        const response = await browser.runtime.sendMessage({
            type: 'ANALYZE_PROMPT',
            apiKey: apiKey,
            prompt: prompt,
            previousAnswers: previousAnswers
        });

        // Hide loading
        loadingIndicator.classList.remove('visible');

        if (response.success) {
            currentAnalysis = response.data;

            // Update token counter if token usage data is available
            if (response.data.tokenUsage) {
                updateTokenDisplay(
                    response.data.tokenUsage.totalTokens,
                    response.data.tokenUsage.cost
                );
            }

            // If there's an improved prompt, update the textarea
            if (response.data.improvedPrompt) {
                promptInput.value = response.data.improvedPrompt;
                currentPrompt = response.data.improvedPrompt;
                // Save the improved prompt
                await browser.storage.local.set({ savedPrompt: response.data.improvedPrompt });
            }

            // Clear old answers since the API returns new questions with new IDs
            // The user will need to re-answer for the new/updated questions
            userAnswers = {};

            // Save the analysis to storage (with empty answers and quality score)
            await browser.storage.local.set({
                savedAnalysis: response.data,
                savedAnswers: {},
                savedQualityScore: response.data.qualityScore || null
            });
            renderAnalysis();
        } else {
            // Handle error from background script
            let errorMessage = response.error || 'Analysis failed';

            if (response.status === 401) {
                errorMessage = 'Invalid API key. Please check your settings.';
            } else if (response.status === 429) {
                errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
            } else if (response.status >= 500) {
                errorMessage = 'Anthropic server error. Please try again later.';
            }

            showError(errorMessage);
        }

    } catch (error) {
        loadingIndicator.classList.remove('visible');
        showError('Error: ' + error.message);
    } finally {
        // Re-enable buttons
        analyzeBtn.disabled = false;
        regenerateBtn.disabled = false;
    }
}

// Render the analysis results
function renderAnalysis() {
    console.log('renderAnalysis called, currentAnalysis:', currentAnalysis);

    if (!currentAnalysis) return;

    // Clear previous content
    summarySection.innerHTML = '';
    questionsSection.innerHTML = '';

    // Render quality score if available
    if (currentAnalysis.qualityScore !== undefined && currentAnalysis.qualityScore !== null) {
        const qualityBadge = document.createElement('div');
        let qualityClass = 'quality-low';
        if (currentAnalysis.qualityScore >= 8) {
            qualityClass = 'quality-high';
        } else if (currentAnalysis.qualityScore >= 5) {
            qualityClass = 'quality-medium';
        }
        qualityBadge.className = `quality-badge ${qualityClass}`;
        qualityBadge.textContent = `Quality: ${currentAnalysis.qualityScore}/10`;
        summarySection.appendChild(qualityBadge);
    }

    // Render risk level and summary
    const riskBadge = document.createElement('div');
    riskBadge.className = `risk-badge ${currentAnalysis.riskLevel || 'medium'}`;
    riskBadge.textContent = `Risk: ${currentAnalysis.riskLevel || 'medium'}`;

    const summaryText = document.createElement('div');
    summaryText.className = 'summary-text';
    summaryText.textContent = currentAnalysis.summary || 'Analysis complete';

    summarySection.appendChild(riskBadge);
    summarySection.appendChild(summaryText);

    console.log('Summary section populated, questions:', currentAnalysis.questions);

    // Render questions
    if (currentAnalysis.questions && currentAnalysis.questions.length > 0) {
        const sectionLabel = document.createElement('div');
        sectionLabel.className = 'section-label';
        sectionLabel.textContent = 'Clarifying Questions';
        questionsSection.appendChild(sectionLabel);

        currentAnalysis.questions.forEach(q => {
            const card = createQuestionCard(q);
            questionsSection.appendChild(card);
        });
    }

    // Show results container and regenerate button
    console.log('Making results visible');
    resultsContainer.classList.add('visible');
    regenerateBtn.classList.add('visible');
}

// Create a question card
function createQuestionCard(question) {
    const card = document.createElement('div');
    card.className = 'question-card';

    // Category badge
    const categoryBadge = document.createElement('div');
    categoryBadge.className = `category-badge ${question.category || 'clarity'}`;
    categoryBadge.textContent = question.category || 'clarity';
    card.appendChild(categoryBadge);

    // Question text
    const questionText = document.createElement('div');
    questionText.className = 'question-text';
    questionText.textContent = question.question;
    card.appendChild(questionText);

    // Explanation
    const explanation = document.createElement('div');
    explanation.className = 'question-explanation';
    explanation.textContent = question.explanation;
    card.appendChild(explanation);

    // Example (if provided)
    if (question.example) {
        const exampleContainer = document.createElement('div');
        exampleContainer.className = 'question-example';

        const exampleLabel = document.createElement('span');
        exampleLabel.className = 'example-label';
        exampleLabel.textContent = 'Example: ';

        const exampleText = document.createElement('span');
        exampleText.className = 'example-text';
        exampleText.textContent = question.example;

        exampleContainer.appendChild(exampleLabel);
        exampleContainer.appendChild(exampleText);
        card.appendChild(exampleContainer);
    }

    // Suggestions (if provided - for uncertain answers)
    if (question.suggestions && question.suggestions.length > 0) {
        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'suggestions-container';

        const suggestionsLabel = document.createElement('div');
        suggestionsLabel.className = 'suggestions-label';
        suggestionsLabel.textContent = '💡 Suggestions:';
        suggestionsContainer.appendChild(suggestionsLabel);

        question.suggestions.forEach(suggestion => {
            const suggestionCard = document.createElement('div');
            suggestionCard.className = 'suggestion-card';
            if (suggestion.recommended) {
                suggestionCard.classList.add('recommended');
            }

            const suggestionHeader = document.createElement('div');
            suggestionHeader.className = 'suggestion-header';
            suggestionHeader.textContent = suggestion.option;
            if (suggestion.recommended) {
                suggestionHeader.textContent = '⭐ ' + suggestion.option + ' (Recommended)';
            }
            suggestionCard.appendChild(suggestionHeader);

            const suggestionExplanation = document.createElement('div');
            suggestionExplanation.className = 'suggestion-explanation';
            suggestionExplanation.textContent = suggestion.explanation;
            suggestionCard.appendChild(suggestionExplanation);

            // Make suggestion clickable to fill answer
            suggestionCard.addEventListener('click', () => {
                const answerInput = card.querySelector('.answer-input');
                if (answerInput) {
                    answerInput.value = suggestion.option;
                    answerInput.dispatchEvent(new Event('input'));
                    // Highlight the selected suggestion
                    card.querySelectorAll('.suggestion-card').forEach(s => s.classList.remove('selected'));
                    suggestionCard.classList.add('selected');
                }
            });

            suggestionsContainer.appendChild(suggestionCard);
        });

        card.appendChild(suggestionsContainer);
    }

    // Answer label
    const answerLabel = document.createElement('div');
    answerLabel.className = 'answer-label';
    answerLabel.textContent = 'Your Answer (optional):';
    card.appendChild(answerLabel);

    // Answer input
    const answerInput = document.createElement('textarea');
    answerInput.className = 'answer-input';
    answerInput.placeholder = 'Type your answer here...';
    answerInput.dataset.questionId = question.id;

    // Pre-fill with existing answer if available
    if (userAnswers[question.id]) {
        answerInput.value = userAnswers[question.id];
    }

    // Update userAnswers on input and save to storage
    answerInput.addEventListener('input', async (e) => {
        const questionId = e.target.dataset.questionId;
        const answer = e.target.value.trim();
        if (answer) {
            userAnswers[questionId] = answer;
        } else {
            delete userAnswers[questionId];
        }

        // Save answers to storage
        try {
            await browser.storage.local.set({ savedAnswers: userAnswers });
        } catch (error) {
            console.error('Error saving answers:', error);
        }
    });

    card.appendChild(answerInput);

    return card;
}

// Update token counter display
function updateTokenDisplay(tokens, cost) {
    if (tokenCount && costAmount) {
        tokenCount.textContent = tokens.toLocaleString();
        costAmount.textContent = cost.toFixed(4);
    }
}

// Show error message
function showError(message) {
    errorArea.textContent = message;
    errorArea.classList.add('visible');
    resultsContainer.classList.remove('visible');
}

// Clear everything including stored data
async function handleClear() {
    promptInput.value = '';
    currentPrompt = '';
    currentAnalysis = null;
    userAnswers = {};
    errorArea.classList.remove('visible');
    resultsContainer.classList.remove('visible');
    regenerateBtn.classList.remove('visible');
    summarySection.innerHTML = '';
    questionsSection.innerHTML = '';
    promptInput.focus();

    // Reset token counter
    updateTokenDisplay(0, 0);

    // Reset token usage in background script
    try {
        await browser.runtime.sendMessage({ type: 'RESET_TOKEN_USAGE' });
    } catch (error) {
        console.error('Error resetting token usage:', error);
    }

    // Clear stored data
    try {
        await browser.storage.local.remove(['savedPrompt', 'savedAnalysis', 'savedAnswers', 'savedQualityScore']);
    } catch (error) {
        console.error('Error clearing stored data:', error);
    }
}
