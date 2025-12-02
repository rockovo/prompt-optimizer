# Prompt Optimizer Extension - Implementation Plan

## Goal

Transform the existing basic prompt optimizer into an intelligent prompt analyzer that:
1. Identifies ambiguities, unclear instructions, and potential hallucination risks in user prompts
2. Generates clarifying questions with explanations
3. Provides an interactive UI where users can answer questions inline
4. Allows regeneration of analysis with incorporated answers

## System Prompt Design for Haiku 4.5

The core of this system is a well-designed system prompt that instructs Haiku to act as a prompt quality analyzer. The prompt will:

**Objectives:**
- Identify 3-5 key issues in the user's prompt that could lead to:
  - Ambiguous interpretations
  - Unclear instructions
  - AI hallucinations
  - Unwanted changes or behaviors
  - Missing context or constraints

**Output Format:**
The system will instruct Haiku to return a **JSON object** with this structure:

```json
{
  "questions": [
    {
      "id": 1,
      "question": "What specific format would you like for the output?",
      "explanation": "Without format specification, the AI might produce results in varying formats (JSON, markdown, plain text, etc.), leading to inconsistent outputs.",
      "category": "clarity"
    },
    {
      "id": 2,
      "question": "Are there any constraints or limitations I should be aware of?",
      "explanation": "Undefined constraints may cause the AI to make assumptions about scope, performance requirements, or resource usage.",
      "category": "scope"
    }
  ],
  "riskLevel": "medium",
  "summary": "This prompt lacks format specification and constraint definitions."
}
```

**Categories:**
- `clarity`: Unclear or ambiguous instructions
- `scope`: Undefined boundaries or missing constraints
- `context`: Missing background information
- `safety`: Potential for hallucinations or harmful outputs
- `completeness`: Missing steps or requirements

## Proposed Changes

### [MODIFY] [background.js](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/background.js)

**Changes:**
1. Rename `CALL_CLAUDE_API` message type to `ANALYZE_PROMPT` (more descriptive)
2. Replace simple optimization prompt with the new system prompt for prompt analysis
3. Update response parsing to handle JSON response structure
4. Add error handling for JSON parsing failures
5. Increase `max_tokens` from 1024 to 2048 to accommodate detailed analysis

**New System Prompt (embedded in background.js):**
```
You are a prompt quality analyzer. Your job is to identify issues in user prompts that could lead to ambiguity, hallucinations, or unwanted AI behavior.

Analyze the following prompt and identify 3-5 key issues. For each issue, generate a clarifying question with an explanation of why it matters.

Return your response as a JSON object with this exact structure:
{
  "questions": [
    {
      "id": 1,
      "question": "...",
      "explanation": "...",
      "category": "clarity|scope|context|safety|completeness"
    }
  ],
  "riskLevel": "low|medium|high",
  "summary": "Brief summary of main issues"
}

IMPORTANT: Return ONLY valid JSON, no additional text.

Prompt to analyze:
{USER_PROMPT}
```

---

### [MODIFY] [popup.html](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/popup.html)

**Changes:**
1. Update button text from "Optimize with Claude" to "Analyze Prompt"
2. Replace single `responseArea` with structured sections:
   - `summarySection`: Shows risk level and summary
   - `questionsSection`: Shows list of questions with inline answer inputs
   - `regenerateSection`: Shows regenerate button (hidden by default)
3. Keep loading indicator as-is
4. Add "Clear" button to reset the form

**New Structure:**
```html
<div class="container">
  <div class="header">
    <h1>Prompt Optimizer</h1>
    <button id="settingsBtn">⚙️</button>
  </div>
  
  <textarea id="promptInput" placeholder="Enter your prompt here..."></textarea>
  
  <div class="button-group">
    <button id="analyzeBtn" class="primary">Analyze Prompt</button>
    <button id="clearBtn" class="secondary">Clear</button>
  </div>
  
  <div id="loadingIndicator" class="loading-indicator">
    <div class="spinner"></div>
    <span>Analyzing prompt...</span>
  </div>
  
  <div id="resultsContainer" class="results-container">
    <div id="summarySection" class="summary-section"></div>
    <div id="questionsSection" class="questions-section"></div>
    <button id="regenerateBtn" class="regenerate-btn">
      🔄 Regenerate with Answers
    </button>
  </div>
</div>
```

---

### [MODIFY] [popup.css](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/popup.css)

**Changes:**
1. Add styles for new components:
   - `.button-group`: Flex layout for multiple buttons
   - `.secondary`: Secondary button styling
   - `.results-container`: Container for analysis results
   - `.summary-section`: Risk badge and summary text
   - `.questions-section`: Question cards with inline inputs
   - `.question-card`: Individual question styling with category badge
   - `.answer-input`: Inline answer text area
   - `.regenerate-btn`: Regenerate button with icon
2. Add risk level colors (low=green, medium=orange, high=red)
3. Add category badge colors
4. Improve spacing and visual hierarchy
5. Add smooth transitions for showing/hiding sections

**Key Styles:**
- Risk badges with colored backgrounds
- Category badges for each question
- Answer inputs styled to blend with question cards
- Hover effects on interactive elements
- Responsive max-height with scroll for many questions

---

### [MODIFY] [popup.js](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/popup.js)

**Complete Rewrite with New Logic:**

**State Management:**
```javascript
let apiKey = null;
let currentPrompt = '';
let currentAnalysis = null;
let userAnswers = {}; // Map of question ID to answer text
```

**Core Functions:**

1. **`analyzePrompt(prompt, answers = {})`**
   - Constructs prompt with previous answers if provided
   - Sends to background script via `ANALYZE_PROMPT` message
   - Parses JSON response
   - Stores in `currentAnalysis`
   - Calls `renderAnalysis()`

2. **`renderAnalysis()`**
   - Renders risk level and summary
   - Renders each question as a card with:
     - Category badge
     - Question text
     - Explanation
     - Answer textarea (pre-filled if exists)
   - Shows regenerate button
   - Attaches event listeners to answer inputs

3. **`handleRegenerate()`**
   - Collects all user answers from textareas
   - Stores in `userAnswers`
   - Calls `analyzePrompt()` with current prompt + answers
   - Constructs enhanced prompt: "Original prompt: {prompt}\n\nContext from previous questions: {answers}"

4. **`handleClear()`**
   - Resets all state variables
   - Clears UI
   - Focuses on prompt input

**Event Listeners:**
- `analyzeBtn`: Calls `analyzePrompt()` with fresh prompt
- `regenerateBtn`: Calls `handleRegenerate()`
- `clearBtn`: Calls `handleClear()`
- Answer textareas: Update `userAnswers` on blur/input

**Error Handling:**
- JSON parsing errors → show user-friendly message
- API errors → display with helpful suggestions
- Empty prompt → validation message
- Missing API key → redirect to settings

## Verification Plan

### Automated Tests

No existing unit tests found in the project. All verification will be manual.

### Manual Verification

#### Test 1: Basic Prompt Analysis
1. Load extension in Firefox (about:debugging → Load Temporary Add-on)
2. Configure API key in settings
3. Open popup
4. Enter test prompt: "Make me a website"
5. Click "Analyze Prompt"
6. **Expected Result:**
   - Loading indicator appears
   - Response shows 3-5 questions about:
     - Website purpose/type
     - Design preferences
     - Technical requirements
     - Target audience
   - Risk level should be "medium" or "high"
   - Each question has category badge and explanation

#### Test 2: Inline Answers
1. After analysis from Test 1
2. Type answers in the textareas for 2-3 questions
3. Verify text persists as you type
4. **Expected Result:**
   - Textareas accept input smoothly
   - Text remains visible and formatted correctly

#### Test 3: Regenerate Functionality
1. After answering questions in Test 2
2. Click "🔄 Regenerate with Answers"
3. **Expected Result:**
   - Loading indicator shows "Analyzing prompt..."
   - New analysis appears with different/refined questions
   - Questions should reference the context from previous answers
   - Previously answered questions should be refined or replaced

#### Test 4: Clear Functionality
1. After completing Test 3
2. Click "Clear" button
3. **Expected Result:**
   - Prompt textarea clears
   - All results disappear
   - Focus returns to prompt input
   - State resets (can start fresh analysis)

#### Test 5: Edge Cases
1. **Empty prompt:** Click analyze with no text → Should show validation error
2. **Very long prompt:** Enter 500+ word prompt → Should handle gracefully
3. **Special characters:** Try prompts with quotes, JSON, code snippets
4. **No API key:** Remove API key from settings, try to analyze → Should show settings message

#### Test 6: Error Handling
1. **Invalid API key:** Set wrong key in settings, attempt analysis
   - **Expected:** "Invalid API key" error message
2. **Network error:** Disconnect internet, attempt analysis
   - **Expected:** Network error message
3. **Malformed JSON response:** (Would need to mock this)
   - **Expected:** Graceful error handling

#### Test 7: Visual Design
1. Review overall aesthetics:
   - Risk badges colored correctly (low=green, medium=orange, high=red)
   - Category badges visible and distinct
   - Question cards have good spacing and readability
   - Answer textareas blend well with design
   - Regenerate button is prominent when shown
2. Test responsive behavior:
   - Popup should be readable at 450px width
   - Long questions/explanations should wrap properly
   - Scroll should appear for many questions

### Success Criteria

✅ Haiku returns structured JSON with 3-5 relevant questions
✅ Questions are insightful and relevant to prompt quality
✅ UI renders questions in readable, organized format
✅ Users can type answers inline
✅ Regenerate incorporates answers into new analysis
✅ Error states display helpful messages
✅ Visual design is polished and professional
