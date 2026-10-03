# Clinical Management System (CMS)

A modern, secure, multilingual Clinical Management System for hospitals, clinics, and health facilities.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |
| Real-time | WebSockets (Socket.io) |
| ORM | TypeORM |
| i18n | react-i18next (EN / SO / AR) |

## Project Structure

```
cms/
├── frontend/        # React application
├── backend/         # NestJS API server
├── database/        # Migrations, seeds, schema
├── uploads/         # Patient documents, lab reports
├── backups/         # Database backups
├── docker/          # Docker configuration
└── docs/            # Documentation
```

## Development Phases

- **Phase 1** ✅ Foundation (Auth, Roles, Layout, i18n)
- **Phase 2** 🔜 Patient Flow (Patients, Appointments, Queue)
- **Phase 3** ⏳ Clinical (Triage, Consultation, Diagnosis, Prescription)
- **Phase 4** ⏳ Diagnostics (Laboratory, Radiology)
- **Phase 5** ⏳ Pharmacy & Inventory
- **Phase 6** ⏳ Finance (Billing, Payments, Insurance)
- **Phase 7** ⏳ Analytics (Dashboards, Reports, Exports)
- **Phase 8** ⏳ Deployment (LAN, Backup, Printing)

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- npm or yarn

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run migration:run
npm run seed
npm run start:dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Access the app at: `http://localhost:5173`
API runs at: `http://localhost:3000`

## LAN Deployment
Set `SERVER_IP` in both `.env` files to your server's local IP.
Client PCs open: `http://SERVER_IP:5173`
