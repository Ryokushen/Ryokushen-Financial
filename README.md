# Ryokushen Financial Tracker

A privacy-focused personal financial management application with unique time-budget features and voice control capabilities. Built with vanilla JavaScript for optimal performance.

## Features

- 💰 **Comprehensive Financial Management**: Track cash accounts, investments, debts, and recurring bills
- 🎤 **Voice Control**: 90+ voice commands for hands-free operation
- 🔒 **Privacy First**: Biometric authentication, blur mode, and panic button
- ⏰ **Time-Budget System**: Convert expenses to work hours
- 📊 **Advanced Analytics**: Spending trends, anomaly detection, and predictive forecasting
- 🤖 **Smart Rules Engine**: Auto-categorization with pattern matching
- 💰 **Pay Calculator**: Comprehensive salary and tax calculations for all 50 states
- 📈 **Historical Tracking**: Database-backed financial snapshots with time-series analysis
- 🔍 **Advanced Search**: Full-text search with complex query builder
- 📊 **Sankey Diagrams**: Interactive cash flow visualizations
- 🎨 **Modern Glass-Morphism UI**: Dark theme optimized with smooth animations

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+ (for development server)
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Clone the repository
git clone https://github.com/Ryokushen/Ryokushen-Financial.git
cd ryokushen-financial

# Install dependencies
npm install

# Start the development server
npm run server
```

Visit `http://localhost:8080` to access the application.

## Development

### Available Scripts

```bash
# Development
npm run server          # Start Python development server

# Testing
npm test               # Run all tests
npm run test:unit      # Run unit tests only
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report

# Code Quality
npm run lint           # Check for linting issues
npm run lint:fix       # Auto-fix linting issues
npm run format         # Format code with Prettier
npm run format:check   # Check code formatting
```

### Code Quality Standards

This project uses **ESLint** and **Prettier** for maintaining code quality:

- **ESLint**: Modern flat config with browser-optimized rules
- **Prettier**: Consistent code formatting (single quotes, 2-space indent, 100 char width)
- **Standards**: ES2022+ syntax, modules, async/await

Before committing code:
```bash
npm run lint:fix    # Fix linting issues
npm run format      # Format code
```

### Project Structure

```
ryokushen-financial/
├── js/
│   ├── app.js              # Main application entry
│   ├── config.js           # Configuration
│   ├── database.js         # Supabase integration
│   └── modules/            # 50+ feature modules
├── css/
│   ├── styles-redesign.css # Main styles
│   └── performance-dashboard.css
├── tests/                  # Jest test suites
├── eslint.config.js        # ESLint configuration
├── .prettierrc             # Prettier configuration
└── package.json            # Dependencies and scripts
```

## Key Technologies

- **Frontend**: Vanilla JavaScript (ES2022+), HTML5, CSS3
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth with magic links
- **APIs**: Finnhub (stock prices), Web Speech API (voice)
- **Charts**: Chart.js for data visualization
- **Testing**: Jest with jsdom
- **Code Quality**: ESLint + Prettier

## Documentation

- [Current Features](current-features.md) - Complete feature list
- [Architecture](architecture.md) - Technical architecture
- [Voice Commands](voice-commands.md) - Voice control reference
- [Performance Guide](performance-guide.md) - Optimization details
- [Design System](design-system.md) - UI/UX guidelines
- [Contributing](CONTRIBUTING.md) - Development guidelines

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code standards and the process for submitting pull requests.

## Security

- All data is stored locally in your browser
- Row Level Security (RLS) ensures data isolation
- Biometric authentication via WebAuthn API
- No tracking or analytics

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Glass-morphism design inspiration
- Chart.js for beautiful visualizations
- Supabase for secure backend infrastructure