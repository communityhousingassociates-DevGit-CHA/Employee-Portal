export const MOCK_USER = {
  id: 'demo-user-1',
  name: 'Alex Torres',
  email: 'demo@communityhousingassociates.org',
  role: 'ceo' as const,
  hire_date: '2024-06-03',
  avatar: 'AT',
}

export const MOCK_BALANCES = {
  pto: { available: 98.4, cap: 400, accrual: 5.08 },
  sick: { available: 25.8, cap: null, accrual: 3.69 },
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
    id: '1', employee: 'Alex Torres', avatar: 'AT', avatarColor: '#02ACC0',
    type: 'PTO', start: '2026-07-03', end: '2026-07-04', hours: 16,
    submitted: '2026-06-25', balance_after: 82.4, note: 'Taking 4th of July weekend.',
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
  { id: '1',  name: 'Alex Torres',     type: 'Full-time',  hire_date: '2024-06-03', tier: '13–24 mo', accrual: 5.08, status: 'active' },
  { id: '2',  name: 'James Thomas',    type: 'Full-time',  hire_date: '2022-03-05', tier: '36+ mo',   accrual: 6.00, status: 'active' },
  { id: '3',  name: 'Carla Wilson',    type: 'Full-time',  hire_date: '2023-08-18', tier: '25–36 mo', accrual: 5.54, status: 'active' },
  { id: '4',  name: 'Maria Edwards',   type: 'Full-time',  hire_date: '2024-01-12', tier: '13–24 mo', accrual: 5.08, status: 'active' },
  { id: '5',  name: 'David Reyes',     type: 'Part-time',  hire_date: '2024-11-01', tier: '0–12 mo',  accrual: 4.62, status: 'active' },
  { id: '6',  name: 'Sandra Kim',      type: 'Full-time',  hire_date: '2025-06-02', tier: '0–12 mo',  accrual: 4.62, status: 'active' },
  { id: '7',  name: 'John Popp',       type: 'Consultant', hire_date: '2026-02-10', tier: '0–12 mo',  accrual: 4.62, status: 'active' },
  { id: '8',  name: 'Tanya Brennan',   type: 'Full-time',  hire_date: '2021-09-14', tier: '36+ mo',   accrual: 6.00, status: 'active' },
  { id: '9',  name: 'Marcus Webb',     type: 'Full-time',  hire_date: '2023-03-22', tier: '25–36 mo', accrual: 5.54, status: 'active' },
  { id: '10', name: 'Priya Nair',      type: 'Full-time',  hire_date: '2025-01-06', tier: '0–12 mo',  accrual: 4.62, status: 'active' },
  { id: '11', name: 'Leon Carter',     type: 'Part-time',  hire_date: '2024-08-19', tier: '13–24 mo', accrual: 5.08, status: 'active' },
  { id: '12', name: 'Yolanda Pierce',  type: 'Full-time',  hire_date: '2022-11-07', tier: '36+ mo',   accrual: 6.00, status: 'active' },
  { id: '13', name: 'Derek Simmons',   type: 'Full-time',  hire_date: '2026-04-01', tier: '0–12 mo',  accrual: 4.62, status: 'active' },
  { id: '14', name: 'Angela Foster',   type: 'Consultant', hire_date: '2025-10-15', tier: '0–12 mo',  accrual: 4.62, status: 'active' },
  { id: '15', name: 'Chris Nguyen',    type: 'Full-time',  hire_date: '2020-06-30', tier: '36+ mo',   accrual: 6.00, status: 'inactive' },
]

export const MOCK_REPORT_ROWS = [
  { name: 'Alex Torres',    pto_used: 16, sick_used: 8,  personal_used: 8,  pto_bal: 98.4,  sick_bal: 25.8, personal_bal: 16, accrual: 5.08 },
  { name: 'James Thomas',   pto_used: 0,  sick_used: 0,  personal_used: 0,  pto_bal: 68.2,  sick_bal: 22.1, personal_bal: 24, accrual: 6.00 },
  { name: 'Carla Wilson',   pto_used: 16, sick_used: 0,  personal_used: 0,  pto_bal: 55.6,  sick_bal: 18.4, personal_bal: 24, accrual: 5.54 },
  { name: 'Maria Edwards',  pto_used: 0,  sick_used: 8,  personal_used: 0,  pto_bal: 112.4, sick_bal: 29.5, personal_bal: 16, accrual: 5.08 },
  { name: 'David Reyes',    pto_used: 0,  sick_used: 0,  personal_used: 8,  pto_bal: 44.0,  sick_bal: 14.7, personal_bal: 16, accrual: 4.62 },
  { name: 'Sandra Kim',     pto_used: 0,  sick_used: 0,  personal_used: 0,  pto_bal: 96.0,  sick_bal: 29.5, personal_bal: 24, accrual: 4.62 },
  { name: 'Tanya Brennan',  pto_used: 24, sick_used: 8,  personal_used: 0,  pto_bal: 134.0, sick_bal: 33.2, personal_bal: 24, accrual: 6.00 },
  { name: 'Marcus Webb',    pto_used: 8,  sick_used: 0,  personal_used: 8,  pto_bal: 72.4,  sick_bal: 19.6, personal_bal: 8,  accrual: 5.54 },
  { name: 'Priya Nair',     pto_used: 0,  sick_used: 0,  personal_used: 0,  pto_bal: 27.7,  sick_bal: 14.8, personal_bal: 24, accrual: 4.62 },
  { name: 'Leon Carter',    pto_used: 0,  sick_used: 8,  personal_used: 0,  pto_bal: 51.2,  sick_bal: 11.1, personal_bal: 24, accrual: 5.08 },
  { name: 'Yolanda Pierce', pto_used: 32, sick_used: 16, personal_used: 8,  pto_bal: 88.6,  sick_bal: 26.3, personal_bal: 8,  accrual: 6.00 },
]
