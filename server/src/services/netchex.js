/**
 * Netchex HRM Integration Service
 *
 * Netchex API v3 — API key auth, header: x-api-key
 * Docs: https://developers.netchex.com/docs
 *
 * To activate: set NETCHEX_API_KEY and NETCHEX_BASE_URL in server/.env
 * Until then, the mock data in src/data/mockData.js is used as a fallback.
 */

import axios from 'axios';

const client = axios.create({
  baseURL: process.env.NETCHEX_BASE_URL || 'https://api.netchex.com',
  headers: { 'x-api-key': process.env.NETCHEX_API_KEY },
  params: { 'api-version': 'v3' },
});

/**
 * Fetch all active employees for the company.
 * Returns an array normalized to the shape used by this app.
 * Netchex endpoint: GET /employees
 */
export async function getEmployees() {
  const { data } = await client.get('/employees');
  return data.items.map(normalizeEmployee);
}

/**
 * Fetch a single employee by their Netchex employee ID.
 * Netchex endpoint: GET /employees/:id
 */
export async function getEmployee(netchexId) {
  const { data } = await client.get(`/employees/${netchexId}`);
  return normalizeEmployee(data);
}

/**
 * Fetch shifts/time-entries for an employee within a date range.
 * Netchex endpoint: GET /time-attendance/shifts  (time & attendance)
 * @param {string} employeeId - Netchex employee ID
 * @param {string} startDate  - 'YYYY-MM-DD'
 * @param {string} endDate    - 'YYYY-MM-DD'
 */
export async function getShifts(employeeId, startDate, endDate) {
  const { data } = await client.get('/time-attendance/shifts', {
    params: { employeeId, startDate, endDate },
  });
  return data.items.map(normalizeShift);
}

/**
 * Fetch all shifts for a date (manager view).
 * Netchex endpoint: GET /time-attendance/shifts
 */
export async function getAllShiftsForDate(date) {
  const { data } = await client.get('/time-attendance/shifts', {
    params: { startDate: date, endDate: date },
  });
  return data.items.map(normalizeShift);
}

/**
 * Fetch time-off requests for an employee.
 * Netchex endpoint: GET /time-attendance/time-off
 */
export async function getTimeOffRequests(employeeId) {
  const { data } = await client.get('/time-attendance/time-off', {
    params: { employeeId },
  });
  return data.items;
}

// ── Shape normalization ────────────────────────────────────────────────────────
// These adapters translate Netchex response shapes into what our app expects.
// Update field names once you have a real API key and can inspect live responses.

function normalizeEmployee(e) {
  return {
    id: e.id,
    email: e.workEmail ?? e.personalEmail,
    name: `${e.firstName} ${e.lastName}`,
    role: e.isManager ? 'admin' : 'employee',
    department: e.department?.name,
    position: e.jobTitle,
    phone: e.workPhone ?? e.mobilePhone,
    hireDate: e.hireDate,
    avatar: `${e.firstName?.[0] ?? ''}${e.lastName?.[0] ?? ''}`.toUpperCase(),
  };
}

function normalizeShift(s) {
  return {
    id: s.id,
    employeeId: s.employeeId,
    date: s.date,
    start: s.startTime?.slice(0, 5), // 'HH:MM'
    end: s.endTime?.slice(0, 5),
    department: s.department?.name,
    position: s.jobTitle,
    location: s.location?.name,
  };
}
