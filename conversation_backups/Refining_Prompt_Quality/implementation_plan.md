# Implementation Plan: Prompt Refinement & Quality Scoring

## Goal
Transform the extension from a passive analyzer into an active refinement tool that iteratively improves prompts through user feedback and AI suggestions.

## User Review Required

> [!IMPORTANT]
> **Workflow Change**: After clicking "Regenerate with Answers", the original prompt will be automatically replaced with an improved version in the textarea. Users can see the evolution of their prompt through iterations.

> [!IMPORTANT]  
> **Quality Score**: A 1-10 quality indicator will be displayed with color coding (red=1-4, yellow=5-7, green=8-10).

---

## Proposed Changes

### Backend Component

#### [MODIFY] [background.js](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/background.js)

**Lines 58-85: Update System Prompt**
- Add instructions to generate an improved prompt based on user answers
- Request a quality score (1-10) for the original prompt
- Update JSON response structure to include `improvedPrompt` and `qualityScore` fields

**Expected Response Structure:**
```json
{
  "questions": [...],
  "riskLevel": "medium",
  "summary": "Brief summary",
  "qualityScore": 6,
  "improvedPrompt": "Enhanced version if answers provided, otherwise null"
}
```

---

### Frontend Component

#### [MODIFY] [popup.js](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/popup.js)

**Lines 19-55: Restore Quality Score**
- Add `savedQualityScore` to storage retrieval
- Restore quality score when popup reopens

**Lines 141-153: Update Prompt After Analysis**
- After successful analysis with answers, update the prompt textarea with `improvedPrompt`
- Save the improved prompt to storage
- Display quality score

**Lines 179-218: Add Quality Score Display**
- Create quality score badge element
- Apply color coding: 
  - Red (1-4): Poor quality
  - Yellow/Orange (5-7): Moderate quality  
  - Green (8-10): Excellent quality
- Render score in the summary section

**Lines 282-301: Clear Quality Score**
- Remove `savedQualityScore` when Clear button is clicked

#### [MODIFY] [popup.html](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/popup.html)

No structural changes needed - quality score will be dynamically added to the summary section.

#### [MODIFY] [popup.css](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/popup.css)

**Add Quality Score Styles**
- `.quality-badge` base styles
- `.quality-low` (red, scores 1-4)
- `.quality-medium` (yellow/orange, scores 5-7)
- `.quality-high` (green, scores 8-10)

---

## Verification Plan

### Manual Verification

**Test 1: Initial Analysis Shows Quality Score**
1. Enter a vague prompt like "make me a website"
2. Click "Analyze Prompt"
3. ✅ Verify quality score badge appears (expect low score 3-5)
4. ✅ Verify badge color is red or yellow

**Test 2: Prompt Auto-Updates with Improvements**
1. Continue from Test 1
2. Answer the clarifying questions with specific details
3. Click "Regenerate with Answers"
4. ✅ Verify the prompt textarea now contains an improved, more detailed prompt
5. ✅ Verify new questions are displayed
6. ✅ Verify quality score increased (expect 6-8)

**Test 3: Iterative Refinement Loop**
1. Continue from Test 2
2. Answer new questions
3. Click "Regenerate with Answers" again
4. ✅ Verify prompt is updated again
5. ✅ Verify quality score increased further (expect 8-10)
6. ✅ Verify badge turns green when score ≥ 8

**Test 4: Persistence Across Sessions**
1. Complete an analysis with quality score
2. Close the popup
3. Reopen the popup
4. ✅ Verify quality score is still displayed
5. ✅ Verify improved prompt persists in textarea

**Test 5: Clear Functionality**
1. With an analysis showing
2. Click "Clear" button
3. ✅ Verify quality score disappears
4. ✅ Verify prompt textarea is empty
5. Close and reopen popup
6. ✅ Verify everything stays cleared
