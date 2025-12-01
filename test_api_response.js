// Test script to check what's happening with the API response
// Open browser console and run this to test the API

async function testAPI() {
    const apiKey = 'YOUR_API_KEY_HERE'; // Replace with your actual API key

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2048,
            messages: [{
                role: 'user',
                content: 'Return this JSON: {"test": "hello", "number": 123}'
            }]
        })
    });

    const data = await response.json();
    console.log('Full response:', data);
    console.log('Content:', data.content);
    console.log('Text:', data.content[0].text);
    console.log('Usage:', data.usage);

    try {
        const parsed = JSON.parse(data.content[0].text);
        console.log('Parsed successfully:', parsed);
    } catch (e) {
        console.error('Parse failed:', e.message);
        console.error('Response text:', data.content[0].text);
    }
}

// Call the test function
testAPI();
