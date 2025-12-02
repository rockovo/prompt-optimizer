# Claude API Integration for Firefox Extension

Extend the existing Firefox Prompt Optimizer extension to integrate with Claude Haiku 4.5 via the Anthropic API. Users will be able to configure their API key via a settings page, send prompts to Claude, and receive optimized responses directly in the popup.

## User Review Required

> [!IMPORTANT]
> **API Key Security**: The API key will be stored using `browser.storage.local`, which is accessible only to the extension and persists across browser sessions. While this is standard for browser extensions, users should be aware that the key is stored locally and not encrypted at rest by the browser.

> [!IMPORTANT]
> **CORS and API Access**: The Anthropic API will be called directly from the extension. This requires the `host_permissions` for `https://api.anthropic.com/*` in the manifest to bypass CORS restrictions.

> [!WARNING]
> **Rate Limiting**: The extension won't implement sophisticated rate limiting on the client side. Users may encounter rate limit errors from Anthropic if they make too many requests. Error messages will inform users to wait before retrying.

## Proposed Changes

### Extension Configuration

#### [MODIFY] [manifest.json](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/manifest.json)

- Add `storage` permission for API key storage
- Add `host_permissions` for `https://api.anthropic.com/*` to allow API calls
- Add `options_ui` configuration pointing to the new settings page
- Update description to reflect new functionality

---

### Settings Page

#### [NEW] [options.html](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/options.html)

Create a settings/options page with:
- Input field for Anthropic API key
- Save button with visual feedback
- Instructions on where to get an API key
- Test API key button to validate the key works

#### [NEW] [options.css](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/options.css)

Styling for the options page matching the existing extension design:
- Consistent color scheme with popup
- Clean, modern layout
- Visual feedback for save/test actions
- Responsive design

#### [NEW] [options.js](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/options.js)

Logic for the settings page:
- Load saved API key from storage on page load
- Save API key to `browser.storage.local` when user clicks save
- Test API key functionality with a simple API call
- Display success/error messages
- Handle edge cases (empty input, invalid key format)

---

### Main Popup Updates

#### [MODIFY] [popup.html](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/popup.html)

- Update button text from "Log to Console" to "Optimize with Claude"
- Add a response display area (div) below the button
- Add a link to open settings page
- Add loading indicator element

#### [MODIFY] [popup.css](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/popup.css)

- Add styles for response display area
- Add loading spinner/indicator styles
- Add error message styles
- Add settings link styles
- Add smooth transitions for better UX

#### [MODIFY] [popup.js](file:///c:/Users/danie/OneDrive/Documents/15.%20Google%20Antigravity/Prompt%20Optimizer%20Extension/popup.js)

Complete rewrite to implement:
- Check for API key on popup load
- If no API key, prompt user to configure settings
- On button click:
  - Validate input is not empty
  - Show loading state
  - Make API call to Anthropic Messages API with Claude Haiku 4 model
  - Display response in the response area
  - Handle errors gracefully with user-friendly messages
- Error handling for:
  - Missing API key
  - Invalid API key (401 errors)
  - Network failures
  - Rate limiting (429 errors)
  - Other API errors (400, 500 series)
- Settings link click handler to open options page

## Verification Plan

### Automated Tests

No automated tests will be created for this initial implementation. Testing will be manual.

### Manual Verification

1. **Settings Page Testing**
   - Load extension in Firefox (`about:debugging`)
   - Navigate to extension options
   - Save an API key and verify it persists after closing/reopening
   - Test "Test API Key" button with valid and invalid keys
   - Verify error messages display correctly

2. **API Integration Testing**
   - Open popup and verify "Configure API key" message appears if no key is set
   - Set a valid API key via settings
   - Enter text in the popup textarea
   - Click "Optimize with Claude" button
   - Verify:
     - Loading indicator appears
     - API response displays in response area
     - Response formatting is readable

3. **Error Handling Testing**
   - Test with invalid API key (verify 401 error handling)
   - Test with empty textarea (verify validation)
   - Test with network disconnected (verify network error handling)
   - Test rapid-fire requests to trigger rate limiting (verify 429 error handling)
   - Test with malformed API responses

4. **User will test with their real Anthropic API key**
   - User will obtain API key from https://console.anthropic.com/
   - User will configure the key in settings
   - User will verify end-to-end functionality with real API calls
