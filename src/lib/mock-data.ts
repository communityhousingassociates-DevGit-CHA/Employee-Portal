export const MOCK_USER = {
  id: 'mock-user-1',
  name: 'Maria Edwards',
  email: 'medwards@communityhousingassociates.org',
  role: 'employee' as const,
  hire_date: '2024-01-12',
  avatar: 'ME',
}

export const MOCK_BALANCES = {
  pto: { available: 112.4, cap: 400, accrual: 5.08 },
  sick: { available: 29.5, cap: null, accrual: 3.69 },
  personal: { available: 16, cap: 24, used: 8 },
}

export const MOCK_REQUESTS = [
  { id: '1', type: 'PTO', start: '2026-07-03', end: '2026-07-04', hours: 16, submitted: '2026-06-25', status: 'pending', approved_by: null },
  { id: '2', type: 'Sick', start: '2026-06-11', end: '2026-06-11', hours: 8, submitted: '2026-06-11', status: 'approved', approved_by: 'N. Sanders' },
  { id: '3', type: 'PTO', start: '2026-05-26', end: '2026-05-27', hours: 16, submitted: '2026-05-20', status: 'approved', approved_by: 'N. Sanders' },
  { id: '4', type: 'Personal', start: '2026-04-04', end: '2026-04-04', hours: 8, submitted: '2026-04-01', status: 'approved', approved_by: 'N. Sanders' },
  { id: '5', type: 'Bereavement', start: '2026-02-03', end: '2026-02-05', hours: 24, submitted: '2026-02-03', status: 'approved', approved_by: 'N. Sanders' },
]

export const MOCK_PENDING_APPROVALS = [
  {
    id: '1', employee: 'Maria Edwards', avatar: 'ME', avatarColor: '#02ACC0',
    type: 'PTO', start: '2026-07-03', end: '2026-07-04', hours: 16,
    submitted: '2026-06-25', balance_after: 96.4, note: 'Taking 4th of July weekend.',
    signed_at: 'Jun 25, 2026 · 9:14 AM',
  },
  {
    id: '2', employee: 'James Thomas', avatar: 'JT', avatarColor: '#7c3aed',
    type: 'PTO', start: '2026-07-13', end: '2026-07-15', hours: 24,
    submitted: '2026-06-28', balance_after: 44.2, note: 'Family vacation.',
    signed_at: 'Jun 28, 2026 · 2:31 PM',
  },
]

export const MOCK_EMPLOYEES = [
  { id: '1', name: 'Maria Edwards', type: 'Full-time', hire_date: '2024-01-12', tier: '13–24 mo', accrual: 5.08, status: 'active' },
  { id: '2', name: 'James Thomas', type: 'Full-time', hire_date: '2022-03-05', tier: '36+ mo', accrual: 6.00, status: 'active' },
  { id: '3', name: 'Carla Wilson', type: 'Full-time', hire_date: '2023-08-18', tier: '25–36 mo', accrual: 5.54, status: 'active' },
  { id: '4', name: 'David Reyes', type: 'Part-time', hire_date: '2024-11-01', tier: '0–12 mo', accrual: 4.62, status: 'active' },
  { id: '5', name: 'Sandra Kim', type: 'Full-time', hire_date: '2025-06-02', tier: '0–12 mo', accrual: 4.62, status: 'active' },
  { id: '6', name: 'John Popp', type: 'Consultant', hire_date: '2026-02-10', tier: '0–12 mo', accrual: 4.62, status: 'active' },
]

export const MOCK_REPORT_ROWS = [
  { name: 'Maria Edwards', pto_used: 0, sick_used: 8, personal_used: 0, pto_bal: 112.4, sick_bal: 29.5 },
  { name: 'James Thomas', pto_used: 0, sick_used: 0, personal_used: 0, pto_bal: 68.2, sick_bal: 22.1 },
  { name: 'Carla Wilson', pto_used: 16, sick_used: 0, personal_used: 0, pto_bal: 55.6, sick_bal: 18.4 },
  { name: 'David Reyes', pto_used: 0, sick_used: 0, personal_used: 8, pto_bal: 44.0, sick_bal: 14.7 },
  { name: 'Sandra Kim', pto_used: 0, sick_used: 0, personal_used: 0, pto_bal: 96.0, sick_bal: 29.5 },
]
