# Transaction Categories Update

## Summary
Added 24 new transaction categories to provide comprehensive financial tracking capabilities.

## Updated Categories

### Original Categories (8)
- Income
- Bills
- Groceries
- Transfer
- Debt
- Interest
- Fees
- Misc

### New Categories Added (24)
1. **Transportation** - Gas, public transit, vehicle maintenance
2. **Dining** - Restaurants, takeout, coffee shops
3. **Healthcare** - Medical expenses, prescriptions, health services
4. **Insurance** - All insurance types (health, auto, life, etc.)
5. **Housing** - Rent, mortgage, home-related expenses
6. **Utilities** - Electric, gas, water, internet, phone
7. **Entertainment** - Movies, concerts, hobbies, streaming
8. **Shopping** - Clothing, household items, general retail
9. **Personal Care** - Haircuts, gym, personal services
10. **Education** - Tuition, books, courses, training
11. **Travel** - Vacation, hotels, flights
12. **Gifts** - Presents, donations, charity
13. **Taxes** - Income tax, property tax, other taxes
14. **Home Improvement** - Repairs, renovations, maintenance
15. **Pet Care** - Vet bills, pet food, supplies
16. **Technology** - Electronics, software, tech services
17. **Subscriptions** - Recurring services, memberships
18. **Savings** - Savings contributions, emergency fund
19. **Investment** - Investment contributions, trading fees
20. **Childcare** - Daycare, babysitting, child expenses
21. **Business** - Business expenses, supplies
22. **ATM/Cash** - Cash withdrawals, ATM fees
23. **Professional Services** - Legal, accounting, consulting
24. **Misc** - (Kept from original) Other uncategorized expenses

## Locations Updated

1. **Transaction Form** (`index.html` lines 188-198)
   - Main transaction entry form category dropdown

2. **Transaction Filter** (`index.html` lines 231-241)
   - Category filter in transaction history

3. **Recurring Bills** (`index.html` lines 625-636)
   - Updated to use main categories with appropriate descriptions
   - Mapped previous categories to new standardized ones:
     - Streaming → Entertainment
     - Rent/Mortgage → Housing
     - Fitness → Personal Care
     - Software → Technology

## Benefits

1. **Comprehensive Coverage** - Covers all major expense categories for personal finance
2. **Better Insights** - More granular categorization enables better spending analysis
3. **Standardization** - Consistent categories across all modules (transactions, recurring bills)
4. **Future-Proof** - Includes modern categories like subscriptions and technology

## Usage Notes

- Categories are ordered logically, with most common ones near the top
- "Misc" remains at the bottom as a catch-all
- Recurring bills use the same categories for consistency
- All existing data remains compatible with the new categories