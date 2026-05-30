# Security Rules

## Authentication
- JWT required for all protected APIs
- Token must be validated on every request

## Data Security
- No secrets in code
- Use environment variables only

## API Security
- Rate limiting must be enabled for public APIs
- Input validation required everywhere

## File Uploads
- Validate file type and size
- Never trust file names from client

## Logging
- Do not log sensitive data (passwords, tokens)