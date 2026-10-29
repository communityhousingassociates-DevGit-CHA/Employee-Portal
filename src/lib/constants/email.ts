// Where replies to portal emails go. The portal sends from portal@communityhousingassociates.org through Resend, and that
// domain has no inbox (no MX record), so a reply to it would bounce. Employee questions are meant to go through the portal;
// this is for administrators who answer by email. Change it here to redirect every portal email at once.
// Shown to employees in the footer of portal emails: the sending address is send-only, so tell them where to go instead.
export const SUPPORT_EMAIL = 'support@globalist.pro'

export const PORTAL_REPLY_TO = 'communityhousingassociates@gmail.com'
