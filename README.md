# Waypoint — Walk-In Follow-Up

A bilingual walk-in system for education consultancy teams. Register a student's visit, route them to a counselor covering their destination, and follow the visit through to completion or a follow-up. The workspace also includes visa and exam applications.

Built by [MhmedMii](https://github.com/MhmedMii).

## 🚀 Live demo

**[Try Waypoint](https://waypoint-student-services-demo.vercel.app)** — no login required.

> All records and sample documents are fictional. Changes stay in your browser, and **Reset demo** restores the starter data. Payments and document uploads are simulated.

![Workspace overview showing fictional visits and counselor activity](docs/screenshots/overview.png)

## ✨ What it does

- **Kiosk intake:** register a fictional first visit, follow-up, or visa/service visit.
- **Routing:** assign new visits to active counselors who cover the selected destination.
- **Counselor desk:** manage a queue, run session and break timers, and record outcomes or follow-up dates.
- **Visas and exams:** submit sample applications, review their progress, and check their status.
- **Management:** explore fictional accounts, team availability, activity logs, and Excel reports.
- **Arabic and English:** switch languages, with right-to-left layouts, light/dark themes, and mobile support.

## Try the workflows

### Register and serve a student

1. Open [the front desk](https://waypoint-student-services-demo.vercel.app/intake).
2. Choose a generated identity and a visit type. For a first visit, choose a study destination.
3. Register the demo visit, then open the counselor desk.
4. Select the assigned demo counselor and click **Start next visit**.
5. Finish the session as completed or requiring a follow-up. The next session starts only after another explicit click.
6. Check the visit list and activity timeline to see the resulting changes.

### Submit and review an application

1. Open [the applicant experience](https://waypoint-student-services-demo.vercel.app/apply).
2. Choose a visa or exam service, then a fictional student identity.
3. Attach generated sample documents and submit.
4. Open the tracking link or inspect the application in the staff view.
5. Move it through the allowed review stages and try **Simulate payment**.

Use **Reset demo** to restore the starter records at any time. Changes persist when reloading the same browser, but they are not shared with other visitors or devices.

### Routes

| **Route**                                  | **View**                               |
| ------------------------------------------ | -------------------------------------- |
| `/`, `/admin`                              | Workspace overview                     |
| `/login`                                   | Demo welcome and perspective selection |
| `/intake`                                  | Front-desk registration                |
| `/admin/visits`                            | Student visits                         |
| `/counselor`                               | Counselor sessions and breaks          |
| `/counselor/students`                      | Assigned student visits                |
| `/visas`, `/exams`                         | Service application lists              |
| `/apply`                                   | Fictional applicant flow               |
| `/apply/status/WP-2401`                    | Example application tracking page      |
| `/admin/supervision`, `/admin/online-now`  | Simulated team overview                |
| `/admin/accounts`                          | Fictional account management           |
| `/admin/activity`, `/admin/online-history` | Demo event timeline                    |
| `/admin/qr-poster`, `/apply/qr-poster`     | Printable demo QR posters              |
| `/api/health`                              | Demo health response                   |

The retained `/forgot-password` and `/reset-password` routes show the demo welcome view. Real password recovery is not active.

## 🎨 Design

A connected-path logo, deep teal and ivory palette, and clear tables keep the workspace focused on the next action. Manrope supports the English interface; Noto Sans Arabic supports Arabic.

The active design tokens and responsive styles live in [src/demo/demo.css](src/demo/demo.css).

## 🛠️ Tech stack

- **App:** Next.js, React, TypeScript
- **Demo data:** browser localStorage
- **Backend reference:** PostgreSQL repositories and service interfaces
- **Styling:** plain CSS, locally bundled fonts, Phosphor icons
- **Tests:** Vitest, Testing Library, Playwright
- **Hosting:** Vercel, connected to this GitHub repository

## 🏗️ Architecture and code layout

Business rules and use cases are separated from database and service implementations. The public demo runs its workflows through typed state transitions in `src/demo`; the retained backend shows the original layered architecture.

```text
src/
├── demo/             # Active screens, fictional fixtures, state, and styles
├── domain/           # Business rules, validation, routing, and workflow states
├── application/      # Use cases and repository/service interfaces
├── adapters/         # PostgreSQL repository implementations
├── infrastructure/   # Auth, encryption, and disabled production connections
├── app/              # Next.js pages, layout, and retained API routes
├── components/       # Shared reference components
├── i18n/             # Reference Arabic and English dictionaries
└── lib/              # Safe browser-storage helpers
```

Start with [DemoApp.tsx](src/demo/DemoApp.tsx) for screen composition, [DemoProvider.tsx](src/demo/DemoProvider.tsx) for persistence, and [model.ts](src/demo/model.ts) for workflow rules.

## ▶️ Run locally

Use Node.js 22.12 or newer. After cloning the repository:

```bash
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). No database setup or environment file is needed. Production API paths are blocked, and the demo cannot connect to the original database.

## 🧪 Tests and checks

```bash
npm test
npm run typecheck
npm run format:check
npm run demo:check
```

For browser tests, install Chromium with `npx playwright install chromium`, then run `npm run test:e2e`.

GitHub Actions runs validation and browser tests on pushes and pull requests. Pushes to `main` deploy automatically to the separate Vercel demo project.

## 🔒 Copyright

Copyright © 2026 [MhmedMii](https://github.com/MhmedMii). All rights reserved.

This repository is publicly available as a portfolio demonstration.
