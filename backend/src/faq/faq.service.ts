import { Injectable } from '@nestjs/common';

interface FaqEntry {
  id: string;
  category: string;
  question: string;
  keywords: string[];
  answer: string;
}

// Offline knowledge base — no network calls, no API key. Extend this array
// as the app grows; each entry just needs a few realistic keyword phrases.
const KNOWLEDGE_BASE: FaqEntry[] = [
  {
    id: 'login-forgot-password',
    category: 'Login',
    question: 'I forgot my password, what do I do?',
    keywords: ['forgot password', 'reset password', "can't log in", 'cant log in', 'locked out', 'forgot my password'],
    answer: 'Click "Forgot password?" on the login screen and enter your username. An administrator will be notified and will set a new temporary password for you — you\'ll be asked to change it the first time you log back in.',
  },
  {
    id: 'change-password',
    category: 'Login',
    question: 'How do I change my password?',
    keywords: ['change password', 'update password', 'new password'],
    answer: 'Click your name in the top right and choose "Change Password" from the menu. You\'ll need your current password to set a new one.',
  },
  {
    id: 'add-appointment',
    category: 'Appointments',
    question: 'How do I schedule a new appointment?',
    keywords: ['schedule appointment', 'new appointment', 'book appointment', 'appointment'],
    answer: 'Go to Appointments in the sidebar and click "New Appointment". Search for the patient, pick a date, time, department, and appointment type, then save.',
  },
  {
    id: 'register-patient',
    category: 'Patients',
    question: 'How do I register a new patient?',
    keywords: ['register patient', 'new patient', 'add patient', 'patient registration'],
    answer: 'Go to Patients \u2192 Register Patient, fill in their details, and save. They\'ll then be searchable everywhere in the app by name, patient number, or phone.',
  },
  {
    id: 'emergency-patient',
    category: 'Patients',
    question: 'How do I check in an emergency patient?',
    keywords: ['emergency patient', 'emergency', 'urgent patient'],
    answer: 'Use Patients \u2192 Emergency Patients to check in and prioritize urgent cases outside the normal queue.',
  },
  {
    id: 'queue',
    category: 'Patient Flow',
    question: 'How does the patient queue work?',
    keywords: ['queue', 'waiting list', 'triage queue', 'consultation queue'],
    answer: 'Queue Management shows everyone currently checked in, grouped by status (waiting, in triage, with doctor, ready for discharge). Clinical staff move patients through triage and consultation from there.',
  },
  {
    id: 'staff-add',
    category: 'Staff',
    question: 'How do I add a new staff member?',
    keywords: ['add staff', 'new staff', 'create user', 'new employee', 'add employee'],
    answer: 'Go to Staff in the sidebar and click "Add Staff". This is only available to administrators \u2014 fill in their name, username, department, position and roles.',
  },
  {
    id: 'staff-reset-password',
    category: 'Staff',
    question: "How do I reset a staff member's password?",
    keywords: ['reset staff password', 'staff password', 'temporary password', "reset someone's password"],
    answer: 'On the Staff page, click the key icon next to their name to generate a new temporary password. Share it with them directly \u2014 they\'ll be asked to change it on next login.',
  },
  {
    id: 'departments',
    category: 'Operations',
    question: 'How do I add or edit a department?',
    keywords: ['add department', 'edit department', 'department', 'departments'],
    answer: 'Go to Departments in the sidebar to add, rename, or assign a head doctor to a department. Every department dropdown elsewhere in the app reads from this list automatically.',
  },
  {
    id: 'leave-request',
    category: 'Leave',
    question: 'How do I request time off?',
    keywords: ['leave request', 'time off', 'vacation', 'sick leave', 'request leave'],
    answer: 'Go to Leave \u2192 Leave Requests and submit a new request with your dates and leave type. Track its status and your remaining balance under Leave Balance.',
  },
  {
    id: 'leave-approve',
    category: 'Leave',
    question: 'How do I approve a leave request?',
    keywords: ['approve leave', 'leave approvals', 'approve time off'],
    answer: "If you're set as an approver (on the Org Chart or Departments page), pending requests show up under Leave \u2192 Approvals for you to approve or reject.",
  },
  {
    id: 'invoice-create',
    category: 'Billing',
    question: 'How do I create an invoice?',
    keywords: ['create invoice', 'new invoice', 'bill patient', 'invoice'],
    answer: 'Go to Billing \u2192 Invoices \u2192 Create Invoice, select the patient and the services or items to bill, then save. You can record a payment against it afterward.',
  },
  {
    id: 'profit-loss',
    category: 'Billing',
    question: 'Where do I find the profit and loss report?',
    keywords: ['profit and loss', 'profit & loss', 'p&l', 'financial report'],
    answer: 'Go to Billing \u2192 Reports \u2192 Profit & Loss. Pick a date range and click Generate \u2014 you can print or export it to Excel from there.',
  },
  {
    id: 'expenses',
    category: 'Billing',
    question: 'How do I submit or approve an expense?',
    keywords: ['submit expense', 'approve expense', 'expense', 'expenses'],
    answer: 'Go to Billing \u2192 Expenses to submit a new expense. Department heads and admins review pending ones from the same page.',
  },
  {
    id: 'pharmacy-dispense',
    category: 'Pharmacy',
    question: 'How do I dispense a prescription?',
    keywords: ['dispense', 'dispensing', 'prescription'],
    answer: 'Go to Pharmacy \u2192 Dispensing, find the prescription, and dispense the medicine. Stock is deducted automatically.',
  },
  {
    id: 'pharmacy-low-stock',
    category: 'Pharmacy',
    question: 'How do I see low stock medicines?',
    keywords: ['low stock', 'out of stock', 'medicine stock'],
    answer: 'Pharmacy \u2192 Low Stock lists every medicine at or below its reorder threshold, so you know what to restock.',
  },
  {
    id: 'pos',
    category: 'Pharmacy',
    question: 'How do I make an over-the-counter sale?',
    keywords: ['pos', 'point of sale', 'walk-in sale', 'sell medicine'],
    answer: "Use Pharmacy \u2192 POS for walk-in sales that aren't tied to a prescription.",
  },
  {
    id: 'lab-order',
    category: 'Laboratory',
    question: 'How do I order or enter a lab test result?',
    keywords: ['lab test', 'laboratory result', 'lab result', 'enter lab result'],
    answer: 'Lab tests ordered during a consultation appear in Laboratory. Open one and use "Enter Result" to record the values once testing is complete.',
  },
  {
    id: 'radiology',
    category: 'Radiology',
    question: 'How do I enter a radiology result?',
    keywords: ['radiology result', 'x-ray', 'scan result', 'imaging'],
    answer: 'Radiology orders show up in the Radiology queue. Open one and use "Enter Result" to add the findings once imaging is done.',
  },
  {
    id: 'blood-bank',
    category: 'Blood Bank',
    question: 'How do I record a blood donation or issue blood units?',
    keywords: ['blood bank', 'blood donation', 'blood units', 'donor'],
    answer: 'Go to Blood Bank to record donations, add or issue units by blood type, and manage the donor list.',
  },
  {
    id: 'org-chart',
    category: 'Operations',
    question: 'What is the Org Chart page for?',
    keywords: ['org chart', 'organization chart', 'reporting structure'],
    answer: 'Org Chart shows the reporting structure across departments and is also where leave approvers are assigned.',
  },
  {
    id: 'beds',
    category: 'Operations',
    question: 'How do I manage beds or bed rent?',
    keywords: ['bed management', 'bed rent', 'ward', 'beds'],
    answer: 'Bed Management (sidebar) tracks ward occupancy. Bed rent charges are billed from Billing \u2192 Bed Rent.',
  },
  {
    id: 'notifications',
    category: 'General',
    question: 'What are the notifications for?',
    keywords: ['notification', 'notifications', 'bell icon', 'alerts'],
    answer: "The bell icon in the top right shows notifications relevant to you \u2014 like prescriptions sent to pharmacy, appointment updates, or password reset requests if you're an administrator.",
  },
  {
    id: 'permissions',
    category: 'General',
    question: "Why can't I see a page or button?",
    keywords: ['permission denied', 'access denied', "can't see", 'no access', 'missing permission'],
    answer: "Most pages are gated by role permissions. If something you need is missing, ask an administrator to check your role's permissions in Settings \u2192 Roles.",
  },
  {
    id: 'settings',
    category: 'General',
    question: 'Where do I change facility settings?',
    keywords: ['facility settings', 'change logo', 'roles and permissions', 'settings'],
    answer: 'Settings (sidebar, admin only) covers facility details, roles & permissions, and test catalogs for lab and radiology.',
  },
];

@Injectable()
export class FaqService {
  private readonly entries = KNOWLEDGE_BASE;

  listAll() {
    return this.entries.map((e) => ({ id: e.id, category: e.category, question: e.question, answer: e.answer }));
  }

  listCategories() {
    const byCategory = new Map<string, { id: string; question: string }[]>();
    for (const e of this.entries) {
      const list = byCategory.get(e.category) ?? [];
      list.push({ id: e.id, question: e.question });
      byCategory.set(e.category, list);
    }
    return Array.from(byCategory.entries()).map(([category, questions]) => ({ category, questions }));
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  // Pure local keyword scoring — no network, no external API. Multi-word
  // keyword phrases found verbatim in the question score highest; loose
  // single-word overlap with the reference question is a smaller tiebreaker.
  ask(question: string) {
    const raw = (question ?? '').trim();
    if (!raw) {
      return {
        answer: 'Ask me anything about using SOMCARE \u2014 for example "how do I schedule an appointment?"',
        matched: null,
        confidence: 0,
      };
    }

    const qLower = raw.toLowerCase();
    const qTokens = new Set(this.tokenize(raw));

    let best: FaqEntry | null = null;
    let bestScore = 0;

    for (const entry of this.entries) {
      let score = 0;
      for (const kw of entry.keywords) {
        const kwLower = kw.toLowerCase();
        if (qLower.includes(kwLower)) {
          score += kwLower.split(/\s+/).length;
        }
      }
      for (const t of this.tokenize(entry.question)) {
        if (qTokens.has(t) && t.length > 3) score += 0.5;
      }
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }

    if (!best || bestScore < 1) {
      return {
        answer:
          "I don't have an answer for that yet. Try rephrasing, or check the Help page for the full list of topics I can help with.",
        matched: null,
        confidence: 0,
      };
    }

    return {
      answer: best.answer,
      matched: { id: best.id, question: best.question, category: best.category },
      confidence: Math.min(1, bestScore / 4),
    };
  }
}
