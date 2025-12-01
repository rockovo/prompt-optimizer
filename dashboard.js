// Dashboard Redesign JS - Tab-based Accordion Layout
// Reuses core logic from dashboard.js with new rendering approach

// ===================================
// DOM ELEMENT REFERENCES
// ===================================

const promptInput = document.getElementById('promptInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const clearBtn = document.getElementById('clearBtn');
const settingsBtn = document.getElementById('settingsBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorArea = document.getElementById('errorArea');
const resultsContainer = document.getElementById('resultsContainer');
const summarySection = document.getElementById('summarySection');
const tabNavigation = document.getElementById('tabNavigation');
const tabContent = document.getElementById('tabContent');
const regenerateBtn = document.getElementById('regenerateBtn');
const tokenCount = document.getElementById('tokenCount');
const costAmount = document.getElementById('costAmount');

// ===================================
// STATE MANAGEMENT
// ===================================

let apiKey = null;
let currentPrompt = '';
let currentAnalysis = null;
let userAnswers = {}; // Map of question ID to answer text
let currentTab = null; // Currently active category tab
let expandedCards = {}; // Map of category -> Set of expanded question IDs

// ===================================
// INITIALIZATION
// ===================================

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

        // Restore saved answers BEFORE rendering
        if (result.savedAnswers) {
            userAnswers = result.savedAnswers;
        }

        // Restore saved analysis
        if (result.savedAnalysis) {
            currentAnalysis = result.savedAnalysis;
            renderAnalysis();
        }

    } catch (error) {
        showError('Error loading data: ' + error.message);
    }
});

// ===================================
// EVENT LISTENERS
// ===================================

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
    }, 500);
});

// Settings button
settingsBtn.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
});

// Clear button
clearBtn.addEventListener('click', handleClear);

// Analyze button
analyzeBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();

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
    expandedCards = {};

    await analyzePrompt(prompt);
});

// Regenerate button
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

// ===================================
// MAIN ANALYSIS FUNCTION
// ===================================

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

            // Update token counter if available
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
                await browser.storage.local.set({ savedPrompt: response.data.improvedPrompt });
            }

            // Clear old answers since API returns new questions with new IDs
            userAnswers = {};

            // Save the analysis to storage
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

// ===================================
// TAB MANAGEMENT
// ===================================

/**
 * Get unique categories from questions
 */
function getCategories(questions) {
    const categories = new Set();
    questions.forEach(q => {
        const category = (q.category || 'general').toLowerCase();
        categories.add(category);
    });
    return Array.from(categories);
}

/**
 * Get questions for a specific category
 */
function getQuestionsByCategory(category) {
    if (!currentAnalysis || !currentAnalysis.questions) return [];
    return currentAnalysis.questions.filter(q =>
        (q.category || 'general').toLowerCase() === category
    );
}

/**
 * Render tab navigation
 */
function renderTabs(questions) {
    tabNavigation.innerHTML = '';

    if (!questions || questions.length === 0) return;

    const categories = getCategories(questions);

    categories.forEach(category => {
        const categoryQuestions = getQuestionsByCategory(category);
        const count = categoryQuestions.length;

        const tabButton = document.createElement('button');
        tabButton.className = 'tab-button';
        tabButton.dataset.category = category;

        if (count === 0) {
            tabButton.classList.add('disabled');
        }

        const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
        tabButton.innerHTML = `${categoryLabel} <span class="count">${count}</span>`;

        tabButton.addEventListener('click', () => {
            if (count > 0) {
                switchTab(category);
            }
        });

        tabNavigation.appendChild(tabButton);
    });

    // Auto-select first non-empty tab
    const firstCategory = categories.find(cat => getQuestionsByCategory(cat).length > 0);
    if (firstCategory) {
        switchTab(firstCategory);
    }
}

/**
 * Switch to a different tab
 */
function switchTab(category) {
    currentTab = category;

    // Update tab button states
    const allTabs = tabNavigation.querySelectorAll('.tab-button');
    allTabs.forEach(tab => {
        if (tab.dataset.category === category) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Render questions for this category
    renderTabContent(category);
}

/**
 * Render content for the active tab
 */
function renderTabContent(category) {
    tabContent.innerHTML = '';

    const questions = getQuestionsByCategory(category);

    if (questions.length === 0) {
        // Show empty state
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = '<p>No questions in this category.</p>';
        tabContent.appendChild(emptyState);
        return;
    }

    // Create tab panel
    const tabPanel = document.createElement('div');
    tabPanel.className = 'tab-panel active';

    // Create accordion cards for each question
    questions.forEach((question, index) => {
        const card = createAccordionCard(question, category, index === 0);
        tabPanel.appendChild(card);
    });

    tabContent.appendChild(tabPanel);
}

// ===================================
// ACCORDION MANAGEMENT
// ===================================

/**
 * Create an accordion card for a question
 */
function createAccordionCard(question, category, autoExpand = false) {
    const card = document.createElement('div');
    card.className = 'accordion-card';
    card.dataset.questionId = question.id;

    // Initialize expanded state for this category if needed
    if (!expandedCards[category]) {
        expandedCards[category] = new Set();
    }

    // Auto-expand first question or restore previous state
    if (autoExpand || expandedCards[category].has(question.id)) {
        card.classList.add('expanded');
        expandedCards[category].add(question.id);
    }

    // === ACCORDION HEADER ===
    const header = document.createElement('div');
    header.className = 'accordion-header';

    const title = document.createElement('div');
    title.className = 'accordion-title';

    // Category badge
    const categoryBadge = document.createElement('div');
    categoryBadge.className = `category-badge ${category}`;
    categoryBadge.textContent = category;
    title.appendChild(categoryBadge);

    // Question title
    const questionTitle = document.createElement('div');
    questionTitle.className = 'question-title';
    questionTitle.textContent = question.question;
    title.appendChild(questionTitle);

    header.appendChild(title);

    // Expand/collapse icon
    const icon = document.createElement('div');
    icon.className = 'accordion-icon';
    icon.textContent = '▶';
    header.appendChild(icon);

    // Header click to toggle
    header.addEventListener('click', () => {
        toggleAccordion(card, category, question.id);
    });

    card.appendChild(header);

    // === ACCORDION CONTENT ===
    const content = document.createElement('div');
    content.className = 'accordion-content';

    const body = document.createElement('div');
    body.className = 'accordion-body';

    // Explanation
    const explanation = document.createElement('div');
    explanation.className = 'question-explanation';
    explanation.textContent = question.explanation;
    body.appendChild(explanation);

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
        body.appendChild(exampleContainer);
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
            const suggestionCard = createSuggestionCard(suggestion, question.id);
            suggestionsContainer.appendChild(suggestionCard);
        });

        body.appendChild(suggestionsContainer);
    }

    // Answer label
    const answerLabel = document.createElement('div');
    answerLabel.className = 'answer-label';
    answerLabel.textContent = 'Your Answer (optional):';
    body.appendChild(answerLabel);

    // Answer input
    const answerInput = document.createElement('textarea');
    answerInput.className = 'answer-input';
    answerInput.placeholder = 'Type your answer here...';
    answerInput.dataset.questionId = question.id;

    // Pre-fill with existing answer if available (ANSWER PERSISTENCE)
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

    body.appendChild(answerInput);
    content.appendChild(body);
    card.appendChild(content);

    return card;
}

/**
 * Create a suggestion card
 */
function createSuggestionCard(suggestion, questionId) {
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
        const answerInput = document.querySelector(`.answer-input[data-question-id="${questionId}"]`);
        if (answerInput) {
            answerInput.value = suggestion.option;
            answerInput.dispatchEvent(new Event('input'));
            // Highlight the selected suggestion
            const allSuggestions = answerInput.closest('.accordion-body').querySelectorAll('.suggestion-card');
            allSuggestions.forEach(s => s.classList.remove('selected'));
            suggestionCard.classList.add('selected');
        }
    });

    return suggestionCard;
}

/**
 * Toggle accordion card expansion
 */
function toggleAccordion(card, category, questionId) {
    const isExpanded = card.classList.contains('expanded');

    if (isExpanded) {
        card.classList.remove('expanded');
        expandedCards[category].delete(questionId);
    } else {
        card.classList.add('expanded');
        expandedCards[category].add(questionId);
    }
}

// ===================================
// RENDERING
// ===================================

/**
 * Render the complete analysis results
 */
function renderAnalysis() {
    if (!currentAnalysis) return;

    // Clear previous content
    summarySection.innerHTML = '';
    tabNavigation.innerHTML = '';
    tabContent.innerHTML = '';

    // === RENDER QUALITY SCORE ===
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

    // === RENDER RISK LEVEL ===
    const riskBadge = document.createElement('div');
    riskBadge.className = `risk-badge ${currentAnalysis.riskLevel || 'medium'}`;
    riskBadge.textContent = `Risk: ${currentAnalysis.riskLevel || 'medium'}`;
    summarySection.appendChild(riskBadge);

    // === RENDER SUMMARY TEXT ===
    const summaryText = document.createElement('div');
    summaryText.className = 'summary-text';
    summaryText.textContent = currentAnalysis.summary || 'Analysis complete';
    summarySection.appendChild(summaryText);

    // === RENDER TABS AND QUESTIONS ===
    if (currentAnalysis.questions && currentAnalysis.questions.length > 0) {
        renderTabs(currentAnalysis.questions);
    } else {
        tabContent.innerHTML = '<div class="empty-state"><p>No clarifying questions at this time.</p></div>';
    }

    // Show results container and regenerate button
    resultsContainer.classList.add('visible');
    regenerateBtn.classList.add('visible');
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

/**
 * Update token counter display
 */
function updateTokenDisplay(tokens, cost) {
    if (tokenCount && costAmount) {
        tokenCount.textContent = tokens.toLocaleString();
        costAmount.textContent = cost.toFixed(4);
    }
}

/**
 * Show error message
 */
function showError(message) {
    errorArea.textContent = message;
    errorArea.classList.add('visible');
    resultsContainer.classList.remove('visible');
}

/**
 * Clear everything including stored data
 */
async function handleClear() {
    promptInput.value = '';
    currentPrompt = '';
    currentAnalysis = null;
    userAnswers = {};
    currentTab = null;
    expandedCards = {};
    errorArea.classList.remove('visible');
    resultsContainer.classList.remove('visible');
    regenerateBtn.classList.remove('visible');
    summarySection.innerHTML = '';
    tabNavigation.innerHTML = '';
    tabContent.innerHTML = '';
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
