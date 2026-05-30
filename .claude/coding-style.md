# Coding Style Rules

## Language
- Only TypeScript allowed for backend

## Naming
- Variables: camelCase
- Functions: camelCase
- Classes: PascalCase
- Files: kebab-case

## Code Quality
- No "any" type unless absolutely necessary
- Always define interfaces/types
- Always handle errors using try/catch

## Structure
- Controller → Service → Repository pattern only
- No direct DB queries in controllers

## Clean Code
- Small reusable functions only
- No duplicate logic