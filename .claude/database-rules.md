# Database Rules

## Naming Convention
- All column names must be camelCase
  Example:
  - userName
  - createdAt
  - mobileNumber

## Data Types
- All dates must be stored as UNIX timestamp (BIGINT)
- No string-based date storage allowed

## Schema Rules
- Always include:
  - id (primary key)
  - createdAt
  - updatedAt
  - isDeleted
  - deletedAt

## Relations
- Use foreign keys properly
- Avoid circular dependencies

## Sync System Rules
- Must support offline mobile sync
- Must support duplicate prevention using deviceId + timestamp

## Database Connection Rule (CRITICAL)

- NEVER create a new database connection inside API handlers
- MUST use a single shared connection pool
- Connection pool must be configured globally at app startup

## Pool Configuration Requirements
- max connections: 10–50 (based on load)
- enable waitForConnections
- limit queue size to prevent overload

## Performance Rules
- Avoid N+1 queries
- Use indexing for all frequently queried columns
- Use caching layer (Redis) for heavy read APIs

## Scalability Rule
- System must be designed for horizontal scaling
- Database layer must not assume single-instance backend

## Schema Organization Rule
- All database schema definitions MUST be placed ONLY in:
  models/schemas/

- No schema definition is allowed outside schemas folder.

- models/ folder can only contain:
  - repository classes
  - data access logic
  - service-level DB wrappers
  
- Any schema created outside schemas/ must be moved immediately during refactor