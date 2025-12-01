# Test Anthropic API Key
# Replace YOUR_API_KEY_HERE with your actual API key

$apiKey = "YOUR_API_KEY_HERE"

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = $apiKey
    "anthropic-version" = "2023-06-01"
}

$body = @{
    model = "claude-3-5-haiku-20241022"
    max_tokens = 10
    messages = @(
        @{
            role = "user"
            content = "Hi"
        }
    )
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "https://api.anthropic.com/v1/messages" -Method Post -Headers $headers -Body $body
    Write-Host "✅ Success! API key works. Status: $($response.StatusCode)" -ForegroundColor Green
    $response.Content
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "Status Code: $statusCode" -ForegroundColor Yellow
        if ($statusCode -eq 401) {
            Write-Host "This means: Invalid API key" -ForegroundColor Yellow
        }
    }
}
