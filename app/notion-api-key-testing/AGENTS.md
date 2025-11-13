# Notion API Key Testing Page

This page allows you to test Notion API keys and their permissions for different operations.

## URL

Visit: [http://localhost:3000/notion-api-key-testing](http://localhost:3000/notion-api-key-testing)

## Features

### Input Fields

- **Notion API Key**: Enter your Notion integration API key (secret\_...)
- **Notion Page ID**: Enter a page ID (with or without hyphens - auto-normalized)
- **Notion Database ID**: Enter a database ID (with or without hyphens - auto-normalized)

### API Tests

- **Get Notion Page**: Tests if the API key can read a specific page
- **Get Notion Database**: Tests if the API key can read a specific database
- **Create Notion Page**: Tests if the API key can create a new page as a child of the specified page

### Results Display

- Success/error alerts for each operation
- Full JSON response from Notion API in formatted `<pre>` blocks
- Proper error handling for common Notion API errors:
  - `unauthorized`: Invalid API key or insufficient permissions
  - `object_not_found`: Page/database not found or not accessible
  - `validation_error`: Invalid request parameters
  - `rate_limited`: Rate limit exceeded

## Usage

1. **Get your Notion API Key**:
   - Go to [Notion Integrations](https://www.notion.so/my-integrations)
   - Create a new integration or use an existing one
   - Copy the API key (starts with `secret_`)

2. **Get Page/Database IDs**:
   - Open a Notion page in your browser
   - Copy the ID from the URL (e.g., `25ef758464c580f6a11aeab7080d03b1`)
   - The tool will automatically normalize UUIDs with or without hyphens

3. **Test Permissions**:
   - Enter your API key and page/database ID
   - Click the relevant test button
   - Review the results to see if your integration has the required permissions

## Common Use Cases

- **Testing Read Permissions**: Use "Get Notion Page" or "Get Notion Database" to verify your integration can read content
- **Testing Write Permissions**: Use "Create Notion Page" to verify your integration can create new content
- **Debugging API Issues**: View full JSON responses to understand what data is returned
- **Validating Integration Setup**: Ensure your Notion integration is properly configured and has access to the desired content

## Error Troubleshooting

- **"API key is invalid"**: Check that your API key is correct and starts with `secret_`
- **"Object not found"**: Ensure the page/database exists and your integration has been granted access to it
- **"Invalid UUID format"**: Check that your page/database ID is a valid 32-character UUID
- **"Rate limit exceeded"**: Wait a moment and try again - Notion has API rate limits

## Security Note

This page uses server-side actions to make API calls, so your API key is not exposed to the browser's client-side code.
