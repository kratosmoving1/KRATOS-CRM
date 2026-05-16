# Kratos CRM Product Model

## Business model

- Customer = person or company contact profile.
- Quote = specific requested service, estimate, or job under a customer.
- A customer can have multiple quotes.
- Quotes belong to a KGC division:
  - Kratos Moving
  - Kratos Cleaning
  - Kratos Painting
  - Kratos Security
  - Other
- "Opportunity" may exist internally as a status or database concept, but it should not dominate user-facing terminology.

## Examples

Customer: Kevin G

Quotes:
- KM-2026-00815 - Kratos Moving - Long Distance - May 21, 2026
- KC-2026-00120 - Kratos Cleaning - Post-move cleaning
- KP-2026-00011 - Kratos Painting - Interior painting

## Implementation note

The current database table is still named `opportunities`. For now, this is an internal implementation detail. The product UI should use Customers and Quotes.
