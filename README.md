# Waypoint — Student Services Platform | Live Demo Version

**Bilingual Student Services Management | Software Engineering Portfolio Project**

Waypoint is a bilingual student-services application designed to support education consultancy operations, from registering student visits and assigning counselors to managing follow-ups, visa applications, and exam services.

The public demo showcases operational workflows, typed business logic, management screens, and bilingual interfaces using fictional data.

**[🌐 View Live Demo](https://waypoint-student-services-demo.vercel.app/)** · **[💻 View Source Code](https://github.com/MhmedMii/waypoint-student-services-demo)**

**Tech Stack:** Next.js · React · TypeScript · PostgreSQL (retained backend reference) · Vitest · Playwright · Vercel

> **Live Demo Version:** All student records, sample documents, and staff profiles are fictional. Demo changes are stored in the visitor's browser, and payments and document uploads are simulated. Production database connections and services are disabled.

![Workspace overview showing fictional visits and counselor activity](docs/screenshots/overview.png)

---

## 📌 Project Overview

Waypoint demonstrates an operational student-services platform for education consultancy teams.

The application brings together student intake, counselor assignments, visit tracking, follow-ups, visa and exam applications, and management reporting in one workspace.

The public demo allows visitors to explore different workflows without accessing a production environment.

### Main Workspaces

| Workspace            | Purpose                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| Front Desk           | Register fictional student visits and service enquiries                  |
| Counselor Desk       | Manage assigned visits, sessions, breaks, and follow-ups                 |
| Visa & Exam Services | Create and track simulated applications                                  |
| Management           | Review fictional accounts, activity logs, team availability, and reports |
| Applicant Experience | Submit sample applications and review their status                       |

---

## ✨ Key Features

### Student Intake & Counselor Assignment

- Register fictional first-time, follow-up, and visa/service visits.
- Select a study destination for first-time visits.
- Assign students to active counselors who cover their selected destination.
- Record and track visit progression.

### Counselor Workflow Management

- Manage counselor queues.
- Start sessions explicitly.
- Track session and break timers.
- Record completed visits and follow-up requirements.
- Schedule follow-up dates.
- Review assigned student records.

### Visa & Exam Applications

- Submit simulated visa and exam applications.
- Attach generated sample documents.
- Track application progress.
- Move applications through allowed review stages.
- Simulate payments.

### Management & Reporting

- Explore fictional staff accounts.
- Review counselor availability and activity.
- Inspect application and visit records.
- View activity timelines.
- Generate Excel reports.

### Bilingual & Responsive Experience

- English and Arabic interfaces.
- Right-to-left layouts.
- Light and dark themes.
- Responsive desktop and mobile layouts.

---

## 🔄 How It Works

### Workflow 1 — Register and Serve a Student

**Student registration → Counselor assignment → Queue → Session → Completion or Follow-up**

1. Open the [Front Desk](https://waypoint-student-services-demo.vercel.app/intake).
2. Choose a fictional student identity and visit type.
3. For a first-time visit, select a study destination.
4. Register the visit and open the counselor workspace.
5. Select the assigned counselor and click **Start next visit**.
6. Complete the session or mark it as requiring a follow-up.
7. Review the visit list and activity timeline.

The next counselor session starts only after an explicit action.

### Workflow 2 — Visa or Exam Application

**Select service → Submit application → Review → Update status → Simulate payment**

1. Open the [Applicant Experience](https://waypoint-student-services-demo.vercel.app/apply).
2. Choose a visa or exam service.
3. Select a fictional student identity.
4. Attach generated sample documents and submit the application.
5. Open the application tracking page or staff workspace.
6. Update the application through the allowed review stages.
7. Try the simulated payment feature.

Use **Reset demo** to restore the starter records.

Changes survive page reloads in the same browser but are not shared across browsers or devices.

---

## 👨‍💻 My Contribution

**Role: Software Developer**

This project demonstrates software engineering work across operational workflows, application state, user interfaces, and testing.

The public implementation includes:

- Building student intake and service-management interfaces.
- Implementing counselor assignment and queue workflows.
- Developing visit and application state transitions.
- Supporting bilingual interfaces and responsive layouts.
- Organizing domain logic separately from application and infrastructure concerns.
- Implementing fictional demo data and browser-based persistence.
- Maintaining automated checks and browser workflow tests.
- Separating the public demonstration from production services and database connections.

---

## 🛠️ Technology & Architecture

| Area                     | Technology                                     |
| ------------------------ | ---------------------------------------------- |
| Framework                | Next.js                                        |
| Frontend                 | React                                          |
| Language                 | TypeScript                                     |
| Styling                  | Plain CSS and locally bundled fonts            |
| Icons                    | Phosphor                                       |
| Demo persistence         | Browser `localStorage`                         |
| Backend reference        | PostgreSQL repositories and service interfaces |
| Unit and component tests | Vitest and Testing Library                     |
| Browser testing          | Playwright                                     |
| Hosting                  | Vercel                                         |

### Architecture Overview

Waypoint separates business rules and use cases from infrastructure and database implementations.

The public demonstration uses typed state transitions in `src/demo` to manage student visits, counselor sessions, applications, and simulated services.

Its retained backend reference documents the layered architecture but does not connect the public demo to a production database.

### Application Layers

**Presentation:** Next.js pages and React components render operational workspaces.

**Domain:** Business rules, validation, counselor routing, and workflow transitions.

**Application:** Use cases and repository/service interfaces.

**Adapters:** Retained PostgreSQL repository implementations.

**Infrastructure:** Authentication, encryption, and disabled production connections.

**Demo Layer:** Fictional data, browser-local persistence, and simulated workflows.

### Interface Design

The interface uses a connected-path logo, deep teal and ivory colors, and practical tables and forms.

Manrope supports the English interface, and Noto Sans Arabic supports Arabic content.

Active design tokens and responsive styles are maintained in [`src/demo/demo.css`](src/demo/demo.css).

---

## 📁 Project Structure

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

### Important Files

- [`DemoApp.tsx`](src/demo/DemoApp.tsx) — Screen composition.
- [`DemoProvider.tsx`](src/demo/DemoProvider.tsx) — Browser persistence and demo state.
- [`model.ts`](src/demo/model.ts) — Workflow actions and business rules.

---

## ▶️ Run Locally

**Requirement:** Node.js 22.12 or newer.

Clone the repository:

```bash
git clone https://github.com/MhmedMii/waypoint-student-services-demo.git
cd waypoint-student-services-demo
```

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No database, environment file, or production credentials are required.

Production API paths are blocked, and the public demo cannot connect to the original database.

---

## 🧪 Testing & Continuous Integration

Waypoint includes automated checks for application behavior, TypeScript, formatting, and public-demo isolation.

```bash
npm test
npm run typecheck
npm run format:check
npm run demo:check
```

### Browser Testing

Install Chromium:

```bash
npx playwright install chromium
```

Run the browser tests:

```bash
npm run test:e2e
```

GitHub Actions is configured to run validation and browser tests on pushes and pull requests.

Pushes to the `main` branch trigger deployment to the separate Vercel demo project.

The presence of automated scripts does not independently confirm that every check currently passes.

---

## 🔒 Demo Limitations & Privacy

Waypoint is a **public live portfolio demonstration**, not the production student-services application.

Important limitations:

- Student records and identities are fictional.
- Staff accounts and team data are fictional.
- Sample documents are generated for the demonstration.
- Document uploads and payments are simulated.
- Demo changes are stored in the visitor's browser.
- Browser state is not shared between visitors or devices.
- Reset demo restores the starting data.
- Production database connections and services are disabled.
- Real password recovery is not active.

The retained `/forgot-password` and `/reset-password` routes display the demo welcome view.

This separation allows visitors to evaluate the application's interface and business workflows without accessing sensitive production data or services.

---

## 🧭 Demo Routes Reference

| Route                                      | Workspace                              |
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

---

## 👨‍💻 Author

**ENG. Mohammed Mahmoud**  
AI & Software Engineer

- **GitHub:** [@MhmedMii](https://github.com/MhmedMii)
- **Portfolio:** [View Portfolio](https://mohammed-mahmoud-portfolio.vercel.app/)

Built as a portfolio project to demonstrate Next.js, React, and TypeScript development, bilingual Arabic/English interfaces, counselor assignment logic, student-service workflows, and layered application architecture. The live demo also showcases typed state management, browser-based persistence, responsive layouts, and automated testing using Vitest and Playwright.
