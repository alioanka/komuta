import { describe, it, expect } from 'vitest';
import { escapeTelegramHtml } from '../src/notifications/telegram.service.js';

describe('escapeTelegramHtml', () => {
  it('escapes HTML-significant characters from user text', () => {
    expect(escapeTelegramHtml('ciro <5000 & x>y')).toBe('ciro &lt;5000 &amp; x&gt;y');
  });

  it('leaves plain Turkish text untouched', () => {
    expect(escapeTelegramHtml('Çamlıca şubesi bugün ciro göndermedi')).toBe(
      'Çamlıca şubesi bugün ciro göndermedi',
    );
  });

  it('neutralises injected tags', () => {
    expect(escapeTelegramHtml('<b>fake</b>')).toBe('&lt;b&gt;fake&lt;/b&gt;');
  });
});
