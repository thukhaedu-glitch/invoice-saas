# AnkoraX Invoice

A modern, full-featured invoicing and finance management platform built for small businesses and freelancers. Create invoices, manage quotations and contracts, track finances, and handle subscription billing — all in one place.

🔗 **Live App:** [invoice-saas-swart-eta.vercel.app](https://invoice-saas-swart-eta.vercel.app)

---

## ✨ Features

### 📄 Documents
- **Invoices** — create, edit, duplicate, share via public link, record payments, send reminders
- **Quotations** — full quotation lifecycle with conversion to invoices
- **Contracts** — digital contracts with e-signature support
- **Public Verification** — every document has a QR code for authenticity verification

### 💰 Finance
- **Chart of Accounts** — double-entry accounting structure
- **Bank Accounts** — track balances with auto-reconciliation
- **Journal Entries** — manual accounting entries
- **Bills & Payables** — vendor bill management
- **Expenses** — expense tracking and categorization
- **Reports & Report Builder** — financial statements and custom reports

### 👥 Workspace
- **Multi-member teams** — invite members with role-based permissions (Owner / Admin / Staff)
- **Customers** — customer relationship management
- **Projects** — project tracking
- **Custom Dashboard** — personalized analytics views
- **Audit Log** — full activity history

### 💳 Subscription & Billing
- **Flexible Plans** — Free, Starter, Growth, Business tiers
- **Flexible Durations** — 1, 3, 6, or 12 month subscriptions
- **Coupons** — promo codes with plan and duration restrictions
- **Usage Tracking** — real-time limit monitoring (documents, customers, members)
- **Feature Gating** — plan-based access control
- **PDF Receipts** — branded receipts with QR verification
- **Cancel & Resubscribe** — flexible subscription management with grace period until expiry

### 🌐 Internationalization
- Multi-language support (English / Burmese) with in-app language switcher

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| Routing | React Router v7 |
| Backend | Firebase (Auth + Firestore + Storage) |
| Styling | Tailwind CSS + custom CSS variables |
| Charts | Recharts |
| PDF | jsPDF + html2canvas |
| QR Codes | qrcode.react |
| i18n | react-i18next |
| Spreadsheets | SheetJS (xlsx) |
| Deployment | Vercel |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 24.x
- A Firebase project (Auth, Firestore, Storage enabled)

### Installation

```bash
# Clone the repository
git clone https://github.com/thukhaedu-glitch/invoice-saas.git
cd invoice-saas

# Install dependencies
npm install

# Set up environment variables (see below)
cp .env.example .env.local

# Run the development server
npm run dev
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

> ⚠️ Never commit `.env.local` to version control. These keys are also configured in your Vercel project settings under **Environment Variables**.

### Build for Production

```bash
npm run build      # Build to /dist
npm run preview    # Preview the production build locally
```

---

## 🔥 Firebase Setup

### Firestore Collections
- `companies/{companyId}` — workspace data, with subcollections for invoices, quotations, customers, etc.
- `users/{userId}` — user profiles
- `upgradeRequests` — subscription payment requests
- `config/plans` — dynamic plan configuration
- `config/commission` — commission tier settings
- `config/receipt` — receipt branding settings
- `coupons` — promo codes

### Firestore Rules
Rules enforce authenticated access per collection, with public read access for verification endpoints (`config`, `coupons`, `upgradeRequests`) so QR-based verification works without login.

### Storage
Used for logos, payment proof screenshots, QR assets, and document attachments.

---

## 📁 Project Structure

```
src/
├── pages/           # Route pages (Invoices, Dashboard, Billing, etc.)
├── components/      # Shared components (Layout, PlanGuard, etc.)
├── hooks/           # Custom hooks (usePlans, useRole, useNotifications)
├── config/          # Plan limits and configuration
├── utils/           # Helpers (audit logging, etc.)
├── i18n.js          # Internationalization config
├── firebase.js      # Firebase initialization
├── App.jsx          # Routes and auth guards
└── main.jsx         # Entry point
```

---

## 🔐 Plan & Feature System

Plans are **fully dynamic** — configured via Firestore and managed through a separate admin CRM. Each plan defines:
- Document, customer, and member limits
- Feature access (finance module, report builder, audit logs)
- Price and discount

The app reads plan configuration at runtime via the `usePlans` hook, so pricing and limits can be updated without redeploying.

---

## 📜 License

Proprietary — All rights reserved.

---

## 🏢 About

Built and maintained by **AnkoraX**. For support, contact the team through the in-app help options.
