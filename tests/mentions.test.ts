import { describe, expect, it } from 'vitest';
import { normaliseHandle, parseMentions, splitMentions } from '@/core/packages/mentions';

/**
 * Who a question is for.
 *
 * The notation has to survive being written by a person in a hurry inside a Markdown
 * file: at the end of a sentence, in brackets, after a colon, twice. What it must never
 * do is invent an addressee out of an ordinary email address in prose, because that would
 * route a question to somebody who was only being quoted.
 */
describe('reading @ out of text', () => {
  it('finds an address and a bare name', () => {
    expect(parseMentions('Soralım @ayse@ornek.com ve @mert')).toEqual(['ayse@ornek.com', 'mert']);
  });

  it('ignores an email address that nobody pointed at', () => {
    expect(parseMentions('Hata raporu destek@ornek.com adresine gitti')).toEqual([]);
  });

  it('reads one at the very start of the text', () => {
    expect(parseMentions('@isa bunu sen mi yazdın?')).toEqual(['isa']);
  });

  it('drops the punctuation that ended the sentence', () => {
    expect(parseMentions('Bunu @ayse@ornek.com, sen bilirsin.')).toEqual(['ayse@ornek.com']);
    expect(parseMentions('(@mert)')).toEqual(['mert']);
  });

  it('names somebody once however many times they are mentioned', () => {
    expect(parseMentions('@mert ve yine @MERT')).toEqual(['mert']);
  });

  it('finds nothing in text that has none', () => {
    expect(parseMentions('Önbellek kararı AC-3 kapsamında.')).toEqual([]);
  });
});

describe('a handle as it is compared', () => {
  it('is lowercase, without the @ and without trailing punctuation', () => {
    expect(normaliseHandle('@Ayse@Ornek.com.')).toBe('ayse@ornek.com');
    expect(normaliseHandle(' MERT ')).toBe('mert');
  });
});

describe('splitting text for display', () => {
  it('keeps the sentence intact and marks the mentions inside it', () => {
    const parts = splitMentions('Soru: @ayse@ornek.com bunu bilir.');
    expect(parts.map((part) => part.text).join('')).toBe('Soru: @ayse@ornek.com bunu bilir.');
    expect(parts.filter((part) => part.handle).map((part) => part.handle)).toEqual([
      'ayse@ornek.com',
    ]);
  });

  it('returns text with no mentions unchanged, in one piece', () => {
    expect(splitMentions('düz metin')).toEqual([{ text: 'düz metin' }]);
  });
});
