# Contributing to Ryokushen Financial

Thank you for your interest in contributing to Ryokushen Financial! This document provides guidelines and standards for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a welcoming environment

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/Ryokushen-Financial.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development Standards

### Code Quality Requirements

Before submitting any code, ensure it meets our quality standards:

```bash
# Run linting checks
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Run all tests
npm test
```

### Code Style Guide

We use **ESLint** and **Prettier** to maintain consistent code quality:

- **JavaScript Version**: ES2022+ with module syntax
- **Quotes**: Single quotes for strings
- **Indentation**: 2 spaces
- **Line Length**: 100 characters maximum
- **Semicolons**: Always required
- **Arrow Functions**: Preferred over function expressions
- **Async/Await**: Preferred over promise chains

### File Organization

```
js/modules/
├── featureName.js       # Main feature implementation
├── featureNameUI.js     # UI components (if separate)
└── tests/
    └── featureName.test.js
```

### Naming Conventions

- **Files**: camelCase (e.g., `transactionManager.js`)
- **Classes**: PascalCase (e.g., `TransactionManager`)
- **Functions**: camelCase (e.g., `calculateBalance()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- **CSS Classes**: kebab-case (e.g., `.transaction-card`)

## Making Changes

### 1. Before You Start

- Check existing issues and pull requests
- For major changes, open an issue first to discuss
- Ensure your changes align with the project's goals

### 2. Development Process

1. Write/update tests for your changes
2. Implement your feature or fix
3. Ensure all tests pass: `npm test`
4. Run code quality checks: `npm run lint:fix && npm run format`
5. Update documentation if needed

### 3. Commit Guidelines

Write clear, descriptive commit messages:

```
feat: add transaction export to PDF
fix: resolve date picker timezone issue
docs: update voice commands documentation
refactor: optimize transaction search performance
test: add unit tests for currency converter
```

### 4. Documentation Requirements

When adding new features:

1. Update `current-features.md` with feature details
2. If it's a planned feature, update `feature-ideas.md`
3. Add any new voice commands to `voice-commands.md`
4. Update the README.md if needed

### 5. Testing Requirements

- Write unit tests for new functions
- Ensure 80%+ code coverage for new code
- Test across different browsers
- Verify privacy mode compatibility
- Check voice command integration

## Pull Request Process

1. Update your branch with the latest main:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. Push your changes to your fork

3. Create a pull request with:
   - Clear title describing the change
   - Reference to any related issues
   - Description of what changed and why
   - Screenshots for UI changes
   - Test results

4. Address review feedback promptly

5. Once approved, your PR will be merged

## Performance Considerations

- Use the existing caching mechanisms
- Leverage memoization for expensive operations
- Follow the performance guide in `performance-guide.md`
- Test with large datasets (1000+ transactions)

## Security Guidelines

- Never commit sensitive data or API keys
- Use Row Level Security (RLS) for new database tables
- Sanitize all user inputs
- Follow OWASP guidelines for web security

## Questions?

- Check the existing documentation
- Open an issue for clarification
- Review the CLAUDE.md file for project-specific conventions

Thank you for contributing to making personal finance management more accessible!