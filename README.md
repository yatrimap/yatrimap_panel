This is the YatriMap admin booking panel built with Next.js.

## What is included

- Unified booking dashboard for rentals, hotels, activities, and packages
- Monthly booking calendar with color markers by booking type
- Daily booking cards with notes, approval actions, and agent indicators
- Agents listing page and individual agent detail workspace
- Local API proxy routes that can call the backend or fall back to realistic mock data

## Environment

If you want the panel to use the real backend, set these environment variables:

```bash
API_BASE_URL=http://localhost:5000
ADMIN_API_TOKEN=your_admin_bearer_token
```

Without them, the UI still works in demo mode using mock data.

## Getting started

```bash
npm run dev
```

Open `http://localhost:3000`.

## Backend endpoints expected

The frontend proxies to:

- `GET /api/admin/insights/bookings`
- `PATCH /api/admin/insights/bookings/:type/:bookingId/note`
- `PATCH /api/admin/insights/bookings/:type/:bookingId/status`
- `GET /api/admin/insights/agents`
- `GET /api/admin/insights/agents/:agentId`

These backend routes were added in the companion API project.
