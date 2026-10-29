import { describe, it, expect } from 'vitest'
import { safeUploadExt, attachmentPathProblem } from './upload-paths'

const OWNER = '962869c0-7187-4a88-bf16-e50204195343'
const OTHER = '11111111-2222-3333-4444-555555555555'
const FILE = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

describe('safeUploadExt', () => {
  it('accepts normal document and image types, case-insensitively', () => {
    expect(safeUploadExt('receipt.PDF')).toBe('pdf')
    expect(safeUploadExt('photo.final.jpeg')).toBe('jpeg')
  })
  it('rejects script/markup types and unknown ones', () => {
    for (const n of ['x.html', 'x.svg', 'x.js', 'x.exe', 'x.php']) expect(safeUploadExt(n)).toBeNull()
  })
  it('rejects names with no extension, or an extension that smuggles a path', () => {
    expect(safeUploadExt('noextension')).toBeNull()
    expect(safeUploadExt('a.png/../../b')).toBeNull()
    expect(safeUploadExt('a./etc/passwd')).toBeNull()
  })
})

describe('attachmentPathProblem', () => {
  it('allows no attachment', () => {
    expect(attachmentPathProblem(null, OWNER)).toBeNull()
    expect(attachmentPathProblem('', OWNER)).toBeNull()
  })
  it('allows a path under the owner\'s own folder', () => {
    expect(attachmentPathProblem(`${OWNER}/${FILE}.pdf`, OWNER)).toBeNull()
  })
  it('refuses another person\'s folder', () => {
    expect(attachmentPathProblem(`${OTHER}/${FILE}.pdf`, OWNER)).not.toBeNull()
  })
  it('refuses traversal, odd names and disallowed extensions', () => {
    for (const p of [`${OWNER}/../${OTHER}/${FILE}.pdf`, `${OWNER}/${FILE}.html`, `${OWNER}/x.pdf`, `${OWNER}/${FILE}.pdf/../x`, `/${OWNER}/${FILE}.pdf`]) {
      expect(attachmentPathProblem(p, OWNER)).not.toBeNull()
    }
  })
})
