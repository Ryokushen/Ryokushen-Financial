# Glass-Morphism Design System

## Design Principles

Ryokushen Financial uses a modern glass-morphism design system that creates depth and sophistication while maintaining excellent readability. The design is privacy-focused, dark-theme optimized, and built for financial data visualization.

## Color System

### Primary Colors
```css
--color-primary: #3b82f6;      /* Blue - Primary actions */
--color-secondary: #10b981;    /* Emerald - Success states */
--color-accent: #8b5cf6;       /* Purple - Highlights */
```

### Status Colors
```css
--color-success: #22c55e;      /* Green - Positive values */
--color-danger: #ef4444;       /* Red - Negative values, alerts */
--color-warning: #f59e0b;      /* Amber - Warnings */
--color-info: #3b82f6;         /* Blue - Information */
```

### Neutral Colors
```css
--color-gray-50: #f9fafb;      /* Lightest gray */
--color-gray-100: #f3f4f6;
--color-gray-200: #e5e7eb;
--color-gray-300: #d1d5db;
--color-gray-400: #9ca3af;
--color-gray-500: #6b7280;
--color-gray-600: #4b5563;
--color-gray-700: #374151;
--color-gray-800: #1f2937;
--color-gray-900: #111827;     /* Darkest gray */
```

### Background Gradients
```css
/* Main app background */
background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);

/* Card backgrounds */
background: rgba(255, 255, 255, 0.05);
backdrop-filter: blur(20px);
```

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
             'Helvetica Neue', Arial, sans-serif;
```

### Type Scale (Ultra-Compact)
```css
--text-xs: 0.65rem;    /* 10.4px - Tiny labels */
--text-sm: 0.75rem;    /* 12px - Small text */
--text-base: 0.875rem; /* 14px - Body text */
--text-lg: 1rem;       /* 16px - Headings */
--text-xl: 1.125rem;   /* 18px - Large headings */
--text-2xl: 1.25rem;   /* 20px - Section headers */
--text-3xl: 1.5rem;    /* 24px - Page titles */
```

### Font Weights
```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

## Spacing System

### Base Unit: 4px
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
```

### Component Spacing
- **Card Padding**: 12px (compact mode)
- **Section Spacing**: 16px between sections
- **Form Spacing**: 8px between inputs
- **Button Padding**: 6px 12px

## Glass-Morphism Components

### Base Glass Effect
```css
.glass-card {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-xl);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
```

### Glass Variations
```css
/* Light glass for overlays */
.glass-light {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
}

/* Dark glass for modals */
.glass-dark {
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(30px);
}

/* Colored glass for status */
.glass-success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.2);
}
```

## Component Patterns

### Cards
```css
.card {
    /* Glass effect */
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    
    /* Spacing */
    padding: 1rem;
    margin-bottom: 1rem;
    
    /* Animation */
    transition: all 0.3s ease;
}

.card:hover {
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}
```

### Buttons
```css
.btn-primary {
    /* Gradient background */
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    
    /* Spacing */
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    
    /* Effects */
    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
    transition: all 0.3s ease;
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.6);
}
```

### Forms
```css
.form-input {
    /* Dark theme optimized */
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e5e7eb;
    
    /* Spacing */
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    
    /* Focus state */
    transition: all 0.3s ease;
}

.form-input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    background: rgba(0, 0, 0, 0.5);
}
```

### Modals
```css
.modal {
    /* Glass background */
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    
    /* Animation */
    animation: modalSlideIn 0.3s ease;
}

@keyframes modalSlideIn {
    from {
        transform: translateY(-50px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}
```

## Border Radius System
```css
--radius-sm: 0.375rem;   /* 6px - Small elements */
--radius-md: 0.5rem;     /* 8px - Buttons, inputs */
--radius-lg: 0.75rem;    /* 12px - Cards */
--radius-xl: 1rem;       /* 16px - Large cards */
--radius-2xl: 1.5rem;    /* 24px - Modals */
--radius-full: 9999px;   /* Pills, badges */
```

## Shadow System
```css
/* Elevation levels */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 14px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.15);
--shadow-xl: 0 12px 40px rgba(0, 0, 0, 0.2);

/* Colored shadows */
--shadow-primary: 0 4px 14px rgba(59, 130, 246, 0.4);
--shadow-success: 0 4px 14px rgba(34, 197, 94, 0.4);
--shadow-danger: 0 4px 14px rgba(239, 68, 68, 0.4);
```

## Animation Guidelines

### Transitions
```css
/* Default timing */
--transition-fast: 150ms ease;
--transition-base: 300ms ease;
--transition-slow: 500ms ease;

/* Common transitions */
.interactive {
    transition: all var(--transition-base);
}
```

### Hover Effects
```css
/* Scale and lift */
.card-hover:hover {
    transform: translateY(-4px) scale(1.02);
}

/* Glow effect */
.btn-glow:hover {
    box-shadow: 0 0 20px currentColor;
}

/* Border highlight */
.input-highlight:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}
```

### Loading States
```css
/* Pulse animation */
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* Spin animation */
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
```

## Responsive Design

### Breakpoints
```css
--screen-sm: 640px;   /* Mobile landscape */
--screen-md: 768px;   /* Tablet */
--screen-lg: 1024px;  /* Desktop */
--screen-xl: 1280px;  /* Large desktop */
```

### Mobile Adaptations
- **Typography**: Scale down by 0.875
- **Spacing**: Reduce padding by 25%
- **Cards**: Stack vertically
- **Tables**: Convert to card layout
- **Navigation**: Hamburger menu

## Privacy Mode Styling

### Blur Effects
```css
.privacy-blur {
    filter: blur(8px);
    user-select: none;
    pointer-events: none;
}

.privacy-reveal {
    filter: none;
    transition: filter 0.3s ease;
}
```

### Click to Reveal
```css
.privacy-clickable {
    cursor: pointer;
    position: relative;
}

.privacy-clickable::after {
    content: "👁 Click to reveal";
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    color: var(--color-gray-400);
}
```

## Accessibility Features

### Focus Indicators
```css
:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
}
```

### High Contrast Mode
```css
@media (prefers-contrast: high) {
    .glass-card {
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid white;
    }
}
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }
}
```

## Component Library

### Status Badges
```css
.badge {
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.65rem;
    font-weight: 600;
}

.badge-success {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
}
```

### Progress Bars
```css
.progress {
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    transition: width 0.3s ease;
}
```

### Tooltips
```css
.tooltip {
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(10px);
    padding: 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
}
```

## Best Practices

### Performance
1. Use CSS transforms for animations
2. Minimize backdrop-filter usage on mobile
3. Lazy load heavy glass effects
4. Use will-change sparingly

### Consistency
1. Always use design tokens (CSS variables)
2. Follow the 4px spacing grid
3. Maintain color semantic meaning
4. Keep animations under 500ms

### Accessibility
1. Ensure 4.5:1 contrast ratios
2. Provide focus indicators
3. Support reduced motion
4. Test with screen readers

### Dark Theme
1. Use rgba colors for flexibility
2. Avoid pure white text
3. Add subtle borders for definition
4. Use shadows for depth