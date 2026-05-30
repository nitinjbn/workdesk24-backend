# Architecture Rules

## System Design
- Modular monolith architecture only
- Must be microservice-ready in future
- Strict separation of modules

## Modules
- auth (auth, users, roles)
- staff (attendance, GPS, activity logs)
- sync (offline mobile sync engine)
- admin (admin portal data)
- public (public APIs)
- reporting (read-only analytics)

## Rules
- Controllers cannot access DB directly
- Must use service + repository pattern
- Each module must be independent
- No cross-module direct imports (use services only)

## API Structure
- /api/v1/app/*
- /api/v1/admin/*
- /api/v1/public/*