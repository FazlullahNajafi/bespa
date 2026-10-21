import { noticeShareText, type ShareableNotice } from './notice-share';

const base: ShareableNotice = {
  title: 'FORM VII – Village Shilikchay Tehsil Kargil',
  body: '',
  categoryLabel: 'Notice',
  publishedLabel: 'Published 14 Oct 2026',
  expiresLabel: 'until 7 Dec 2026',
  sourceLabel: 'District Administration, Kargil',
  documentUrl: 'https://cdn.s3waas.gov.in/x/uploads/2026/10/1792.pdf',
  footer: 'Shared from Bespa',
};

describe('noticeShareText', () => {
  it('leads with the title, because WhatsApp shows two lines in a group list', () => {
    expect(noticeShareText(base).split('\n')[0]).toBe(
      '*FORM VII – Village Shilikchay Tehsil Kargil*',
    );
  });

  it('names the publisher and both dates for a mirrored notice', () => {
    const text = noticeShareText(base);
    expect(text).toContain('Notice · District Administration, Kargil');
    expect(text).toContain('Published 14 Oct 2026 · until 7 Dec 2026');
    expect(text).toContain(base.documentUrl!);
    expect(text.endsWith('Shared from Bespa')).toBe(true);
  });

  it('omits the expiry rather than leaving a dangling separator', () => {
    const text = noticeShareText({ ...base, expiresLabel: null });
    expect(text).toContain('Published 14 Oct 2026\n');
    expect(text).not.toContain('·  ');
    expect(text).not.toContain('Published 14 Oct 2026 ·');
  });

  it('carries a village notice as words, with no document line', () => {
    const text = noticeShareText({
      ...base,
      title: 'Water supply off on Friday',
      body: 'The main line is being repaired. Store water on Thursday night.',
      sourceLabel: null,
      documentUrl: null,
      expiresLabel: null,
    });

    expect(text).toContain('The main line is being repaired.');
    expect(text).not.toContain('📄');
    // No source, so the attribution line is the category alone — not "Notice · ".
    expect(text).toContain('\nNotice\nPublished');
  });

  it('never emits a run of blank lines, whichever fields are missing', () => {
    for (const notice of [
      base,
      { ...base, expiresLabel: null },
      { ...base, body: 'words', documentUrl: null, sourceLabel: null },
      { ...base, documentUrl: null },
    ]) {
      expect(noticeShareText(notice)).not.toMatch(/\n{3}/);
    }
  });
});
