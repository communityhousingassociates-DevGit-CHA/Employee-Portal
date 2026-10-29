// Guards for the signed-upload flow. The browser uploads straight to a private storage bucket using a signed URL the server
// issued, then sends the resulting path back when it saves the record. Both halves are client-controlled, so the server
// validates them: the extension is clamped to a short allowlist (so it can't carry a '/' or a script type), and a saved path
// must sit under the owner's own folder (so nobody can attach — and later read back — another person's file).

const ALLOWED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt'])

/** The file's extension if it is on the allowlist, else null. */
export function safeUploadExt(fileName: string): string | null {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : ''
  return ALLOWED_EXTENSIONS.has(ext) ? ext : null
}

/** A saved attachment path is valid only if it is empty, or `<ownerId>/<uuid>.<allowed ext>` with nothing odd in it. */
export function attachmentPathProblem(path: string | null | undefined, ownerId: string): string | null {
  if (!path) return null
  const m = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.([a-z0-9]{1,5})$/i.exec(path)
  if (!m || m[1].toLowerCase() !== ownerId.toLowerCase() || !ALLOWED_EXTENSIONS.has(m[3].toLowerCase())) return 'That attachment is not valid. Please upload it again.'
  return null
}
