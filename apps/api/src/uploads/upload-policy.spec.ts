import { assertUploadAllowed } from './upload-policy';

describe('upload policy', () => {
  it('rejects unexpected file types and oversized images', () => {
    expect(assertUploadAllowed('image/svg+xml', 1000).ok).toBe(false);
    expect(assertUploadAllowed('image/jpeg', 5 * 1024 * 1024 + 1).ok).toBe(false);
    expect(assertUploadAllowed('image/webp', 2048).ok).toBe(true);
  });
});
