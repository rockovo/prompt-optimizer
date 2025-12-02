# Token Usage and Cost Tracker

Add a session-based token usage and cost tracker to the Prompt Optimizer extension, displaying total tokens consumed and estimated costs in USD based on Claude model rates.

## Proposed Changes

### Background Script

#### [MODIFY] [background.js](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/background.js)

**Token Tracking State:**
- Add session-level state variables to track cumulative `inputTokens` and `outputTokens`
- Initialize both counters to 0 when background script loads

**API Response Handling:**
- Extract `usage.input_tokens` and `usage.output_tokens` from Anthropic API responses in the `analyzePrompt()` function
- Accumulate these values into the session state after each successful API call
- Send updated token data back with the analysis response

**Cost Calculation:**
- Add a `calculateCost()` helper function that:
  - Takes model name, input tokens, and output tokens as parameters
  - Returns cost in USD using the rate table:
    - `claude-haiku-4-5-20251001`: $1 input / $5 output per 1M tokens
    - `claude-sonnet-4-5-20251001`: $3 input / $15 output per 1M tokens (if applicable)
    - `claude-opus-4-5-20251001`: $15 input / $75 output per 1M tokens (if applicable)
  - Formula: `(inputTokens / 1_000_000 * inputRate) + (outputTokens / 1_000_000 * outputRate)`

**Reset Functionality:**
- Add new message handler for `RESET_TOKEN_USAGE` message type
- When received, reset both token counters to 0

---

### Popup UI

#### [MODIFY] [popup.html](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/popup.html)

- Add a new `<div>` element with id `tokenCounter` positioned at the top-left of the container (before or within the header)
- Structure:
  ```html
  <div id="tokenCounter" class="token-counter">
    <div class="token-label">Session Usage:</div>
    <div class="token-value"><span id="tokenCount">0</span> tokens</div>
    <div class="cost-value">$<span id="costAmount">0.0000</span></div>
  </div>
  ```

#### [MODIFY] [popup.css](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/popup.css)

- Add `.token-counter` styling:
  - Position: top-left corner, with small margin/padding
  - Font: small size (10-11px), muted color (#718096 or similar gray)
  - Layout: compact, minimal visual weight
  - Display token count and cost in a clean, aligned format

#### [MODIFY] [popup.js](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/popup.js)

**DOM References:**
- Add references to `#tokenCount` and `#costAmount` span elements

**Token Display Update:**
- Create `updateTokenDisplay(tokens, cost)` helper function
- Updates the displayed token count and cost (formatted to 4 decimal places: `cost.toFixed(4)`)

**API Response Handling:**
- In `analyzePrompt()` function, after receiving successful response from background script:
  - Extract token data from response (if included)
  - Call `updateTokenDisplay()` with new cumulative values

**Clear Button Enhancement:**
- In `handleClear()` function:
  - Send `RESET_TOKEN_USAGE` message to background script to reset counters
  - Reset displayed values to "0 tokens" and "$0.0000"

**State Restoration:**
- Load token counters from browser storage on popup open
- Save token counters to browser storage after each update

---

### Dashboard UI

#### [MODIFY] [dashboard.html](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/dashboard.html)

- Add the same `tokenCounter` element structure as in popup.html (in the header section)

#### [MODIFY] [dashboard.css](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/dashboard.css)

- Add the same `.token-counter` styling as in popup.css

#### [MODIFY] [dashboard.js](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/dashboard.js)

- Implement the same token tracking logic as in popup.js:
  - DOM references for token display elements
  - `updateTokenDisplay()` function
  - Extract and display token data from API responses
  - Reset on Clear button click
  - State restoration from storage

---

## Verification Plan

### Automated Tests

No existing automated tests found in the codebase. Manual testing will verify functionality.

### Manual Verification

1. **Token Tracking Across API Calls:**
   - Load the extension in Firefox
   - Open the popup
   - Enter a prompt and click "Analyze Prompt"
   - Verify that the token counter displays a non-zero value after the API response
   - Enter a different prompt and analyze again
   - Verify that the token count **increases** (cumulative across session)
   - Check that the cost also increases proportionally

2. **Cost Calculation Accuracy:**
   - Note the token counts displayed (e.g., "1500 tokens")
   - Given the model is `claude-haiku-4-5-20251001`, manually calculate expected cost:
     - Assume split like 1000 input + 500 output tokens for example
     - Cost = (1000/1_000_000 × $1) + (500/1_000_000 × $5) = $0.0010 + $0.0025 = $0.0035
   - Verify the displayed cost is reasonable (within expected range for Haiku model)

3. **Reset Functionality:**
   - Click the "Clear" button
   - Verify token counter resets to "0 tokens"
   - Verify cost resets to "$0.0000"
   - Analyze a new prompt
   - Verify counters start accumulating from 0 again

4. **Dashboard Consistency:**
   - Open the dashboard view (full tab)
   - Perform the same tests as above
   - Verify token counter displays and updates correctly in dashboard
   - Verify consistency between popup and dashboard displays

5. **Styling and Positioning:**
   - Verify the token counter is positioned in the top-left
   - Verify it uses a small font and muted color (unobtrusive)
   - Verify it doesn't interfere with other UI elements
   - Check on both popup and dashboard views

6. **State Persistence (Optional Enhancement):**
   - Note current token count
   - Close and reopen the popup
   - Verify token count persists across popup sessions (if implemented)
