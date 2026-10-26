import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import {
  BACKEND_CAPABILITIES,
  FIREBASE_CAPABILITIES,
  type BackendCapabilities,
} from './backend-capabilities';

describe('BACKEND_CAPABILITIES', () => {
  it('defaults to Firebase Spark capabilities', () => {
    const caps = TestBed.inject(BACKEND_CAPABILITIES);
    expect(caps).toEqual(FIREBASE_CAPABILITIES);
    expect(caps.id).toBe('firebase');
    expect(caps.attachments).toBe(false);
    expect(caps.formattingToolbar).toBe(true);
    expect(caps.reactions).toBe(true);
    expect(caps.replies).toBe(true);
  });

  it('can be overridden by custom provider', () => {
    const custom: BackendCapabilities = {
      ...FIREBASE_CAPABILITIES,
      id: 'supabase',
      name: 'Supabase Cloud',
      attachments: true,
      typingIndicator: true,
      presence: true,
    };

    TestBed.configureTestingModule({
      providers: [{ provide: BACKEND_CAPABILITIES, useValue: custom }],
    });

    const caps = TestBed.inject(BACKEND_CAPABILITIES);
    expect(caps.id).toBe('supabase');
    expect(caps.attachments).toBe(true);
    expect(caps.typingIndicator).toBe(true);
  });
});
