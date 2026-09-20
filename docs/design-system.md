# eChat visual foundation

Reference inspected in Brave: <https://stitch.withgoogle.com/projects/6989032576724662244>

The Stitch project presents a compact B2B operations console with a dark navigation rail, light slate surfaces, dense data cards, and petrol-teal actions. The implementation uses the reference as a direction, keeping the product identity and components original.

## Extracted language

- Background: `#f4f7fa`; surfaces: `#ffffff`; muted surface: `#eef3f7`.
- Sidebar: `#0f172a` with slate text and teal selected state.
- Border: `#dbe4ec`; primary: `#0f766e`; accent/success: `#10b981`.
- Warning: `#d97706`; danger: `#dc2626`; text: `#0f172a`; muted: `#64748b`.
- Headings use Plus Jakarta Sans-like weight; body and labels use Inter-like compact text.
- Desktop rail is 236px, topbar is 72px, page padding is 28px, card padding is 20px, and gaps are 16px.
- Cards and inputs use 12–16px radii; badges use 999px; shadows are soft and shallow.
- Density is intentionally high for the inbox list, medium for CRM cards, and airy around dashboard metrics.

## Reference coverage

Dashboard, Inbox, Inbox chat detail, CRM kanban, Contacts, opportunity context, Team, Channels, and Settings frames were present in the Stitch canvas. No separate mobile frame was surfaced; mobile behavior is implemented as a stacked inbox with a contact drawer.

