// Automatic sign-out after inactivity. The browser records real user activity (mouse, keys, scroll, touch) in a cookie; the
// middleware refuses to serve a page to a session whose last activity is older than IDLE_LOGOUT_MS, and the portal shows a warning
// shortly before that. Background polling (notification bell) deliberately does not count as activity.
export const IDLE_LOGOUT_MS = 4 * 60 * 60 * 1000
export const IDLE_WARNING_MS = 5 * 60 * 1000
export const ACTIVITY_COOKIE = 'cha_last_active'
