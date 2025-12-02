# Dashboard UI Enhancements - Task Breakdown

## Previous Work (Completed)
- [x] Tab-based accordion layout implementation
- [x] Answer persistence across tab switches
- [x] Resizable textarea
- [x] 40/60 grid layout

## New Features - Question Tracking

### Planning Phase
- [x] Analyze current code structure
- [x] Plan badge color logic
- [x] Plan validation popup system
- [x] Review plan with user (approved with clarifications)

### Implementation Phase

#### Tab Badge Color Indicators
- [x] Add CSS for red badge (unanswered questions)
- [x] Add CSS for green badge (all answered)
- [ ] Track answered questions per category in real-time
- [ ] Update badge colors dynamically as user types
- [ ] Reset badges to red when new analysis arrives

#### Regeneration Validation
- [ ] Create custom modal popup component (HTML/CSS)
- [ ] Implement "no answers" validation (block regeneration)
- [ ] Implement "partial answers" validation (show confirmation)
- [ ] Display unanswered questions grouped by category
- [ ] Add user choice buttons (Proceed/Cancel)

#### JavaScript Logic
- [ ] Add `getAnsweredQuestionsInCategory()` function
- [ ] Add `getCategoryCompletionStatus()` function  
- [ ] Add `showConfirmationModal()` function
- [ ] Update `renderTabs()` to set badge colors
- [ ] Update answer input handlers to trigger badge updates
- [ ] Update regenerate button handler with validation

### Verification Phase
- [ ] Test badge turns green when all category questions answered
- [ ] Test badge stays red when questions unanswered
- [ ] Test "no answers" popup blocks regeneration
- [ ] Test "partial answers" popup shows correct categories
- [ ] Test badges reset to red after regeneration
- [ ] Verify popup styling matches theme
