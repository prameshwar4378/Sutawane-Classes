# Sutawane Classes Management System

Developed by **Ultoxy Technologies** for **Sutawane Classes**.

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/prameshwar4378/Sutawane-Classes)
[![Live Web Application](https://img.shields.io/badge/Live_Deployment-GitHub_Pages-brightgreen?logo=githubpages)](https://prameshwar4378.github.io/Sutawane-Classes/)
[![Desktop Application](https://img.shields.io/badge/Windows_Setup-1.0.0_Signed-purple?logo=windows)](https://github.com/prameshwar4378/Sutawane-Classes/releases)

### 🌐 Live Production Links
- **GitHub Repository:** [https://github.com/prameshwar4378/Sutawane-Classes](https://github.com/prameshwar4378/Sutawane-Classes)
- **Live Web Production Preview:** [https://prameshwar4378.github.io/Sutawane-Classes/](https://prameshwar4378.github.io/Sutawane-Classes/)
- **Production Windows Desktop Installer:** Signed setup package (`release/Sutawane Classes Management Software Setup 1.0.0.exe`) signed by **Ultoxy Technologies**.

---

### 🔐 Default Credentials
- **Role:** Administrator
- **Username:** `sutawane`
- **Password:** `sutawane@123`
- **Developer Portal Access:** Secure OTP verification via `prameshwar4378@gmail.com`

---

## 🛠️ Technology Stack

- **Frontend:** React 19 + Vite 6 + TypeScript
- **Styling & UI:** Tailwind CSS, shadcn/ui design tokens, Lucide React icons
- **Navigation:** React Router v7
- **Data Fetching:** TanStack Query (React Query v5)
- **Forms & Validation:** React Hook Form + Zod
- **Charts:** Recharts
- **Backend API:** Node.js + Express + TypeScript
- **Database:** SQLite (local persistent storage) with Prisma ORM
- **Desktop Packaging:** Electron with `contextIsolation: true` & `nodeIntegration: false`, electron-builder
- **Testing:** Vitest & Playwright

---

## 🏗️ Project Architecture

```
├── frontend/           # React + Vite application (runs on port 5173)
├── backend/            # Express API server + Prisma SQLite layer (runs on port 5000)
├── shared/             # Shared TypeScript schemas, DTOs and Zod validators
├── electron/           # Electron main process & secure preload bridge
└── data/dev/           # Local development persistent storage
```

### 🔒 Persistent Storage
The application stores its database (`sutawane.db`), student photographs, and backups in the OS persistent application data directory:
- **Windows:** `%APPDATA%\SutawaneClasses\data\`
- **Development:** `./data/dev/`

Important records are never stored in temporary build directories or relying on browser localStorage.

---

## 🚀 Getting Started

### 1. Installation
Install dependencies across all workspaces:
```bash
npm install
```

### 2. Generate Prisma Database Client
```bash
npm run db:generate
npm run db:push
```

### 3. Running in Development
Start both backend (port 5000) and frontend (port 5173) concurrently:
```bash
npm run dev
```

Run inside Electron desktop shell:
```bash
npm run dev:electron
```

### 4. Running Tests
Run automated tests:
```bash
npm test
```

### 5. Production Build
Build all workspaces:
```bash
npm run build
```

Package Windows desktop application:
```bash
npm run package:win
```

---

## 📋 Key Modules & Features

1. **Branch-Wise Management:** Complete isolation of student admissions, installments, fee collections, and expenses per branch. Global branch selector allows viewing individual branches or All Branches consolidated.
2. **Academic Sessions:** Track admissions by academic year (e.g. 2026–27, 2027–28). Historical records are preserved permanently.
3. **Installment Fee System:** Agreed fees, custom or equal installments, partial payments, automated sequential receipt generation, and payment reversal audit trail.
4. **Expense Management:** Track branch overheads including Rent, Teacher Salaries, Electricity, Internet, and Stationery.
5. **Reports:** 16 comprehensive reports with print, CSV, and Excel exports.
6. **Data Safety:** One-click snapshots and restoration.
