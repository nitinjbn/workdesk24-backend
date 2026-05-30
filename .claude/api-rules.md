# API Rules

## Method Rules
- POST must be used for all read and write operations

## Authentication
- NO API without JWT authentication
- Public APIs must be explicitly marked

## Standards
- All responses must follow standard format:
{
  success: boolean,
  message: string,
  data: any
}

## Validation
- All inputs must be validated
- Never trust client data

## Versioning
- All APIs must use /api/v1
- I should have the flexibility to release new version for any API later.

## Postman Collection Sync Rule
- Every API change MUST be reflected in Postman collection.
- No API endpoint can be considered complete unless Postman is updated.

## Mandatory Behavior
- When creating or modifying any API:
  1. Update Postman collection JSON
  2. Validate request/response format
  3. Ensure authentication headers are included