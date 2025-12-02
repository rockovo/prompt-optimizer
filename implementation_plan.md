# Question Tracking Features - Implementation Plan

## Overview

Add visual indicators (red/green badges) to show question completion status per category, and implement validation popups before regenerating to ensure users have provided answers.

---

## Requirements Summary

1. **Badge Color Indicators**: Tab count badges change from red (unanswered) to green (all answered)
2. **Regeneration Validation**: Prevent regeneration if no answers; warn if partial answers
3. **Custom Modal Popup**: Display unanswered questions grouped by category
4. **Real-time Updates**: Badge colors update as user types
5. **Reset on New Analysis**: Badges reset to red when new questions arrive

---

## Proposed Changes

### CSS Updates

#### [MODIFY] [dashboard.css](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/dashboard.css)

**Add badge color variants:**
```css
/* Red badge - unanswered questions */
.tab-button .count.unanswered {
    background-color: #fc8181;
    color: #742a2a;
}

/* Green badge - all answered */
.tab-button .count.answered {
    background-color: #68d391;
    color: #22543d;
}

.tab-button.active .count.unanswered {
    background-color: #e53e3e;
    color: white;
}

.tab-button.active .count.answered {
    background-color: #38a169;
    color: white;
}
```

**Add modal popup styles:**
```css
/* Modal overlay */
.modal-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    align-items: center;
    justify-content: center;
}

.modal-overlay.visible {
    display: flex;
}

/* Modal content */
.modal-content {
    background: white;
    border-radius: 12px;
    padding: 30px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.modal-header {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 15px;
    color: #1a202c;
}

.modal-body {
    margin-bottom: 20px;
    color: #4a5568;
    line-height: 1.6;
}

.modal-buttons {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}
```

### HTML Updates

#### [MODIFY] [dashboard.html](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/dashboard.html)

**Add modal overlay at end of body (before closing `</body>`):**
```html
<!-- Confirmation Modal -->
<div id="confirmationModal" class="modal-overlay">
    <div class="modal-content">
        <div id="modalHeader" class="modal-header"></div>
        <div id="modalBody" class="modal-body"></div>
        <div class="modal-buttons">
            <button id="modalCancel" class="secondary-btn">Cancel</button>
            <button id="modalConfirm" class="primary-btn">Proceed Anyway</button>
        </div>
    </div>
</div>
```

### JavaScript Updates

#### [MODIFY] [dashboard.js](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/dashboard.js)

**Changes to make:**

1. **Add DOM references for modal** (after line 20):
   ```javascript
   const confirmationModal = document.getElementById('confirmationModal');
   const modalHeader = document.getElementById('modalHeader');
   const modalBody = document.getElementById('modalBody');
   const modalCancel = document.getElementById('modalCancel');
   const modalConfirm = document.getElementById('modalConfirm');
   ```

2. **Add helper functions** (new section around line 235):
   ```javascript
   /**
    * Get answered questions in a category
    */
   function getAnsweredQuestionsInCategory(category) {
       const categoryQuestions = getQuestionsByCategory(category);
       return categoryQuestions.filter(q => userAnswers[q.id] && userAnswers[q.id].trim());
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
   ```

3. **Modify renderTabs()** (around line 269):
   - Add `unanswered` class to badge by default
   - Change: `tabButton.innerHTML = `${categoryLabel} <span class="count unanswered">${count}</span>`;`

4. **Update answer input handler** (around line 461):
   - Add call to `updateBadgeColor()` after saving answer
   - Add after line 475:
     ```javascript
     // Update badge color for this question's category
     const question = currentAnalysis.questions.find(q => q.id === questionId);
     if (question) {
         updateBadgeColor((question.category || 'general').toLowerCase());
     }
     ```

5. **Add modal control functions** (new section):
   ```javascript
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
   ```

6. **Replace regenerate button handler** (lines 123-140):
   ```javascript
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
       
       // Check if user has answered ANY questions
       const totalAnswers = Object.keys(userAnswers).filter(k => userAnswers[k]).length;
       
       if (totalAnswers === 0) {
           // Block regeneration - no answers at all
           showModal(
               'No Answers Provided',
               '<p>Please answer at least one question before regenerating the analysis.</p>',
               () => {} // No action, just close
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
                   await analyzePrompt(currentPrompt, userAnswers);
               }
           );
           return;
       }
       
       // All questions answered, proceed directly
       await analyzePrompt(currentPrompt, userAnswers);
   });
   ```

7. **Update renderAnalysis()** (after rendering tabs around line 567):
   - Add call to update all badge colors after renderTabs():
     ```javascript
     renderTabs(currentAnalysis.questions);
     updateAllBadgeColors(); // Update badge colors based on current answers
     ```

---

## Implementation Order

1. ✅ Update CSS (badge colors + modal styles)
2. ✅ Update HTML (add modal structure)
3. ✅ Update JavaScript:
   - Add DOM references
   - Add helper functions
   - Modify renderTabs()
   - Update answer input handler
   - Add modal control functions
   - Replace regenerate button handler
   - Update renderAnalysis()

---

## Testing Plan

### Manual Verification

1. **Badge Colors**:
   - [ ] Load dashboard with existing questions
   - [ ] Verify all badges start as red
   - [ ] Answer all questions in one category
   - [ ] Verify that category's badge turns green
   - [ ] Leave some questions unanswered in another category
   - [ ] Verify that category stays red

2. **Regeneration - No Answers**:
   - [ ] Click Regenerate without answering any questions
   - [ ] Verify modal appears: "Please answer at least one question"
   - [ ] Verify regeneration is blocked

3. **Regeneration - Partial Answers**:
   - [ ] Answer 2 questions in Scope, 0 in Context, 1 in Safety
   - [ ] Click Regenerate
   - [ ] Verify modal shows: "Scope: 0 unanswered, Context: 2 unanswered, Safety: 1 unanswered"
   - [ ] Click "Cancel" - verify modal closes, no regeneration
   - [ ] Click Regenerate again, click "Proceed Anyway"
   - [ ] Verify regeneration proceeds

4. **Badge Reset**:
   - [ ] After regeneration, verify all badges reset to red (new questions)

---

## Summary

This implementation adds:
- ✅ Visual feedback via badge colors (red/green)
- ✅ Answer tracking per category
- ✅ Validation before regeneration
- ✅ Custom modal popup matching theme
- ✅ Real-time badge updates as user types
- ✅ Automatic badge reset on new analysis

All changes are isolated to UI layer with no API modifications required.
