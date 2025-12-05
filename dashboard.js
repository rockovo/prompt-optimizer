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
const generateFinalBtn = document.getElementById('generateFinalBtn');
const tokenCount = document.getElementById('tokenCount');
const costAmount = document.getElementById('costAmount');

// Modal Elements
const confirmationModal = document.getElementById('confirmationModal');
const modalHeader = document.getElementById('modalHeader');
const modalBody = document.getElementById('modalBody');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');

// ===================================
// STATE MANAGEMENT
// ===================================

let apiKey = null;
let currentPrompt = '';
let currentAnalysis = null;
let userAnswers = {}; // Current round answers (keyed by question ID)
let answerHistory = {}; // Accumulated answers across all rounds (keyed by question text)
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

        // Restore answer history (accumulated across rounds)
        if (result.savedAnswerHistory) {
            answerHistory = result.savedAnswerHistory;
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
    answerHistory = {}; // Clear accumulated history for fresh start
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
        const questionId = parseInt(input.dataset.questionId, 10);
        const answer = input.value.trim();

        // Find the question object to get the question text
        const questionObj = currentAnalysis.questions.find(q => q.id === questionId);

        if (answer && questionObj) {
            // Store question text, answer, and category
            userAnswers[questionId] = {
                question: questionObj.question,
                answer: answer,
                category: questionObj.category || 'general'
            };
        }
    });

    // Update Generate Final button visibility
    updateGenerateFinalButtonVisibility();

    // Check if user has answered ANY questions
    const totalAnswers = Object.keys(userAnswers).filter(k => userAnswers[k]?.answer?.trim()).length;

    if (totalAnswers === 0) {
        // Block regeneration - no answers at all
        showModal(
            'No Answers Provided',
            '<p>Please answer at least one question before regenerating the analysis.</p>',
            () => { } // No action, just close
        );
        return;
    }

    // Check if there are unanswered questions
    const totalQuestions = currentAnalysis.questions.length;
    const unansweredCount = totalQuestions - totalAnswers;

    if (unansweredCount > 0) {
        // Build list of unanswered questions by category
        const categories = getCategories(currentAnalysis.questions);
        const unansweredByCategory = [];

        categories.forEach(category => {
            const categoryQuestions = getQuestionsByCategory(category);
            const answeredInCategory = getAnsweredQuestionsInCategory(category);
            const unansweredInCategory = categoryQuestions.length - answeredInCategory.length;

            if (unansweredInCategory > 0) {
                const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
                unansweredByCategory.push(`<li><strong>${categoryLabel}:</strong> ${unansweredInCategory} unanswered</li>`);
            }
        });

        // Show confirmation modal
        showModal(
            'Unanswered Questions',
            `<p>You have <strong>${unansweredCount}</strong> unanswered question${unansweredCount > 1 ? 's' : ''}:</p>
             <ul style="margin: 10px 0; padding-left: 20px;">${unansweredByCategory.join('')}</ul>
             <p>Do you want to proceed anyway?</p>`,
            async () => {
                // Merge current answers into history before regenerating
                Object.entries(userAnswers).forEach(([questionId, answerData]) => {
                    if (answerData?.question && answerData?.answer) {
                        answerHistory[answerData.question] = {
                            answer: answerData.answer,
                            category: answerData.category || 'general'
                        };
                    }
                });

                // Send accumulated history to API
                await analyzePrompt(currentPrompt, answerHistory);
            }
        );
        return;
    }

    // All questions answered, proceed directly
    // Merge current answers into history before regenerating
    Object.entries(userAnswers).forEach(([questionId, answerData]) => {
        if (answerData?.question && answerData?.answer) {
            answerHistory[answerData.question] = {
                answer: answerData.answer,
                category: answerData.category || 'general'
            };
        }
    });

    // Send accumulated history to API
    await analyzePrompt(currentPrompt, answerHistory);
});

// Generate Final Prompt button click handler
generateFinalBtn.addEventListener('click', async () => {
    console.log('Generate final prompt clicked');
    // TODO: Implement final prompt generation logic
});

// Update Generate Final button visibility based on answers
function updateGenerateFinalButtonVisibility() {
    const hasAnswers = Object.keys(answerHistory).length > 0 || Object.keys(userAnswers).length > 0;

    if (hasAnswers) {
        generateFinalBtn.style.display = 'flex';
    } else {
        generateFinalBtn.style.display = 'none';
    }
}

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
            console.log('[Dashboard] Checking for improved prompt:', response.data.improvedPrompt);
            if (response.data.improvedPrompt) {
                console.log('[Dashboard] Updating prompt input with improved prompt');
                promptInput.value = response.data.improvedPrompt;
                currentPrompt = response.data.improvedPrompt;
                await browser.storage.local.set({ savedPrompt: response.data.improvedPrompt });
            } else {
                console.log('[Dashboard] No improved prompt in response (expected for first analysis)');
            }

            // Clear current round answers (new questions need fresh input)
            userAnswers = {};

            // Save the analysis and preserve answer history
            await browser.storage.local.set({
                savedAnalysis: response.data,
                savedAnswers: {},  // Clear current round
                savedAnswerHistory: answerHistory,  // PRESERVE accumulated history
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
 * Get answered questions in a category
 */
function getAnsweredQuestionsInCategory(category) {
    const categoryQuestions = getQuestionsByCategory(category);
    return categoryQuestions.filter(q => userAnswers[q.id]?.answer?.trim());
}

/**
 * Check if all questions in category are answered
 */
function isCategoryComplete(category) {
    const categoryQuestions = getQuestionsByCategory(category);
    const answeredQuestions = getAnsweredQuestionsInCategory(category);
    return categoryQuestions.length > 0 &&
        categoryQuestions.length === answeredQuestions.length;
}

/**
 * Update badge color for a specific category
 */
function updateBadgeColor(category) {
    const tabButton = document.querySelector(`.tab-button[data-category="${category}"]`);
    if (!tabButton) return;

    const badge = tabButton.querySelector('.count');
    if (!badge) return;

    badge.classList.remove('unanswered', 'answered');
    if (isCategoryComplete(category)) {
        badge.classList.add('answered');
    } else {
        badge.classList.add('unanswered');
    }
}

/**
 * Update all badge colors
 */
function updateAllBadgeColors() {
    const categories = getCategories(currentAnalysis.questions || []);
    categories.forEach(category => updateBadgeColor(category));
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
        tabButton.innerHTML = `${categoryLabel} <span class="count unanswered">${count}</span>`;

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

    // Example (if provided) - with clickable options
    if (question.example) {
        const exampleContainer = document.createElement('div');
        exampleContainer.className = 'question-example';

        const exampleLabel = document.createElement('span');
        exampleLabel.className = 'example-label';
        exampleLabel.textContent = 'Example: ';
        exampleContainer.appendChild(exampleLabel);

        // FIX: Strip redundant "Example:" or "Examples:" prefix from API response
        let cleanExample = question.example.replace(/^(Examples?|e\.?g\.?)[:\s]+/i, '').trim();

        // Try to parse options from the example text
        const parsed = parseExampleOptions(cleanExample);

        // FIX: Display label if present (text before colon)
        if (parsed.label) {
            const labelSpan = document.createElement('span');
            labelSpan.className = 'example-text';
            labelSpan.textContent = parsed.label + ': ';
            exampleContainer.appendChild(labelSpan);
        }

        if (parsed.options.length > 0) {
            // Render as clickable options
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'example-options';

            parsed.options.forEach(option => {
                const optionElement = document.createElement('span');
                optionElement.className = 'example-option';
                optionElement.textContent = option;

                // FIX: Make option clickable to APPEND to answer (multi-select)
                optionElement.addEventListener('click', () => {
                    const answerInput = document.querySelector(`.answer-input[data-question-id="${question.id}"]`);
                    if (answerInput) {
                        const currentValue = answerInput.value.trim();

                        // Check if this option is already in the answer
                        const currentOptions = currentValue ? splitByCommasRespectingParentheses(currentValue) : [];

                        if (!currentOptions.includes(option)) {
                            // Append with comma separator if not empty
                            if (currentValue) {
                                answerInput.value = currentValue + ', ' + option;
                            } else {
                                answerInput.value = option;
                            }
                            answerInput.dispatchEvent(new Event('input'));
                        }

                        // Toggle selected state
                        if (optionElement.classList.contains('selected')) {
                            optionElement.classList.remove('selected');
                        } else {
                            optionElement.classList.add('selected');
                        }
                    }
                });

                optionsContainer.appendChild(optionElement);
            });

            exampleContainer.appendChild(optionsContainer);
        } else {
            // Fallback: render as plain text
            const exampleText = document.createElement('span');
            exampleText.className = 'example-text';
            exampleText.textContent = cleanExample;
            exampleContainer.appendChild(exampleText);
        }

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
    if (userAnswers[question.id]?.answer) {
        answerInput.value = userAnswers[question.id].answer;
    }

    // Update userAnswers on input and save to storage
    answerInput.addEventListener('input', async (e) => {
        // FIX: Parse questionId to number to match question.id type
        const questionId = parseInt(e.target.dataset.questionId, 10);
        const answer = e.target.value.trim();

        // Find the question object to get the question text
        const questionObj = currentAnalysis.questions.find(q => q.id === questionId);

        if (answer && questionObj) {
            // Store both question text and answer
            userAnswers[questionId] = {
                question: questionObj.question,
                answer: answer
            };
        } else {
            delete userAnswers[questionId];
        }

        // Update badge color for this question's category
        if (questionObj) {
            updateBadgeColor((questionObj.category || 'general').toLowerCase());
        }

        // Update Generate Final button visibility
        updateGenerateFinalButtonVisibility();

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
// MODAL MANAGEMENT
// ===================================

/**
 * Show confirmation modal
 */
function showModal(header, body, onConfirm) {
    modalHeader.textContent = header;
    modalBody.innerHTML = body;
    confirmationModal.classList.add('visible');

    // Remove old listeners
    const newCancelBtn = modalCancel.cloneNode(true);
    const newConfirmBtn = modalConfirm.cloneNode(true);
    modalCancel.replaceWith(newCancelBtn);
    modalConfirm.replaceWith(newConfirmBtn);

    // Update references
    // Note: We don't update the global variables here to avoid confusion, 
    // but we attach listeners to the new elements.

    // Add new listeners
    newCancelBtn.addEventListener('click', hideModal);
    newConfirmBtn.addEventListener('click', () => {
        hideModal();
        onConfirm();
    });
}

/**
 * Hide confirmation modal
 */
function hideModal() {
    confirmationModal.classList.remove('visible');
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
        updateAllBadgeColors(); // Update badge colors based on current answers
        updateGenerateFinalButtonVisibility(); // Update generate final button visibility
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
 * Split text by commas, but ignore commas inside parentheses
 * Example: "option1, option2 (e.g., example), option3" 
 *       -> ["option1", "option2 (e.g., example)", "option3"]
 */
function splitByCommasRespectingParentheses(text) {
    // Protect commas inside parentheses
    let protected = text.replace(/\(([^)]+)\)/g, (match) => match.replace(/,/g, '{{COMMA}}'));
    // Split on unprotected commas
    let parts = protected.split(',').map(p => p.trim());
    // Restore commas inside parentheses
    return parts.map(p => p.replace(/\{\{COMMA\}\}/g, ','));
}

/**
 * Parse example text to extract clickable options
 * Handles patterns like: "e.g., 'option A', 'option B', or 'option C'"
 * Also handles: "Do you prefer: option1, option2, option3"
 * Returns: { label: string|null, options: string[] }
 */
function parseExampleOptions(exampleText) {
    if (!exampleText || typeof exampleText !== 'string') return { label: null, options: [] };

    let textToParse = exampleText;
    let label = null;

    // Check for colon-separated label (e.g., "Do you prefer: option1, option2")
    const colonIndex = exampleText.indexOf(':');
    if (colonIndex > 0 && colonIndex < exampleText.length - 1) {
        const beforeColon = exampleText.substring(0, colonIndex).trim();
        const afterColon = exampleText.substring(colonIndex + 1).trim();

        // Skip label logic if beforeColon starts with question words (likely the actual question)
        const questionWords = /^(is|are|does|do|what|how|where|when|why|which|can|could|would|should|will)\b/i;
        const isQuestion = questionWords.test(beforeColon);

        // If the part before colon looks like a question/label (short, ends with colon)
        // and the part after has content, treat it as label + options
        if (beforeColon.length < 80 && afterColon.length > 0 && !isQuestion) {
            label = beforeColon;
            textToParse = afterColon;
        } else if (isQuestion && afterColon.length > 0) {
            // Question detected in example field - just parse the part after colon
            textToParse = afterColon;
        }
    }

    // Pattern 1: Extract text within single quotes 'like this'
    const singleQuoteMatches = textToParse.match(/'([^']+)'/g);
    if (singleQuoteMatches && singleQuoteMatches.length > 1) {
        return {
            label: label,
            options: singleQuoteMatches.map(match => match.slice(1, -1).trim())
        };
    }

    // Pattern 2: Extract text within double quotes "like this"
    const doubleQuoteMatches = textToParse.match(/"([^"]+)"/g);
    if (doubleQuoteMatches && doubleQuoteMatches.length > 1) {
        return {
            label: label,
            options: doubleQuoteMatches.map(match => match.slice(1, -1).trim())
        };
    }

    // Pattern 3: Try comma-separated values
    if (textToParse.includes(',')) {
        // Remove common prefixes like "e.g.," "such as", etc.
        const cleanText = textToParse
            .replace(/^(e\.?g\.?|such as|like|for example|Examples?)[,:]?\s*/i, '')
            .trim();

        // Protect commas inside parentheses before splitting
        let protected = cleanText.replace(/\(([^)]+)\)/g, (match) => match.replace(/,/g, '{{COMMA}}'));

        // Split by commas and optional conjunctions, clean up each option
        const parts = protected
            .split(/,\s*(?:or\s+|and\s+)?|\s+or\s+|\s+and\s+/i)
            .map(part => part.trim().replace(/\{\{COMMA\}\}/g, ','))
            .filter(part => part.length > 0 && part.length < 100); // Reasonable length filter

        // Only return if we got 2+ distinct short options
        if (parts.length >= 2 && parts.every(p => p.length < 50)) {
            return {
                label: label,
                options: parts
            };
        }
    }

    // No parseable options found
    return { label: label, options: [] };
}

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
    answerHistory = {};
    currentTab = null;
    expandedCards = {};
    updateGenerateFinalButtonVisibility(); // Hide generate final button after clearing
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
