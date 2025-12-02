# Add Full-Page Dashboard View to Chrome Extension

Add a full-page browser tab view to the Prompt Optimizer extension while maintaining the existing popup functionality. The dashboard will reuse existing styles and functionality but take advantage of the full browser tab space.

## User Review Required

> [!IMPORTANT]
> The dashboard will be a completely separate HTML page that shares styles and functionality with the popup. Both will work independently and maintain their own state through browser.storage.

## Proposed Changes

### Extension Files

#### [NEW] [dashboard.html](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/dashboard.html)

New full-page HTML file that:
- Uses a wider, more spacious layout optimized for full browser tabs
- Includes the same components as popup (header, prompt input, analysis results)
- Links to `dashboard.css` for full-page specific styles
- Links to `dashboard.js` for functionality
- Adds a "Back to Popup" button/link for convenience

#### [NEW] [dashboard.css](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/dashboard.css)

New stylesheet that:
- Imports or duplicates base styles from `popup.css`
- Overrides layout constraints (removes 500px width limit)
- Implements responsive grid/flexbox layout for wider displays
- Adds max-width constraints for readability (e.g., 1200px centered)
- Enhances spacing to take advantage of available screen space

#### [NEW] [dashboard.js](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/dashboard.js)

New JavaScript file that:
- Reuses the same logic as `popup.js`
- Shares the same state management through browser.storage
- Implements all the same event handlers and API interactions
- May be refactored to share common code with popup.js in future iterations

#### [MODIFY] [popup.html](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/popup.html)

Add an "Open Full View" button or icon to the header:
- Positioned near the settings button for consistency
- Uses an appropriate icon (e.g., 🖥️ or ⛶)
- Styled to match the existing UI aesthetic

#### [MODIFY] [popup.js](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/popup.js)

Add event handler for the new button:
- Uses `chrome.tabs.create({ url: 'dashboard.html' })` to open dashboard
- Alternatively uses `browser.tabs.create()` for Firefox compatibility (extension already uses `browser` API)

#### [MODIFY] [manifest.json](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/manifest.json)

Update if necessary to ensure dashboard.html is accessible:
- May not need changes as HTML files in extension root are typically accessible
- Will verify during implementation

## Verification Plan

### Automated Tests
No automated tests planned for this feature.

### Manual Verification

1. **Popup Functionality**
   - Open extension popup
   - Verify all existing functionality works as before
   - Check that "Open Full View" button is visible and properly styled

2. **Dashboard Opening**
   - Click "Open Full View" button in popup
   - Verify dashboard opens in a new browser tab
   - Verify URL is correct (chrome-extension://[id]/dashboard.html)

3. **Dashboard Functionality**
   - Enter a prompt in the dashboard
   - Click "Analyze Prompt"
   - Verify analysis works identically to popup
   - Check that quality scores, questions, and regeneration work

4. **Shared State**
   - Make changes in popup (e.g., enter a prompt, analyze it)
   - Open dashboard and verify it shows the same saved state
   - Make changes in dashboard
   - Reopen popup and verify state persists

5. **Layout & Spacing**
   - Verify dashboard uses full browser width (up to reasonable max-width)
   - Check that all UI elements are properly spaced
   - Test responsive behavior by resizing browser window
   - Ensure text remains readable and not stretched excessively
