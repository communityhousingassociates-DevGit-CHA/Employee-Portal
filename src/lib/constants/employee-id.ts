export function formatEmployeeId(employeeNumber: number): string {
  return `CHA-${String(employeeNumber).padStart(4, '0')}`
}
