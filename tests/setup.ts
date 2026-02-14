/**
 * Test setup file - mocks browser globals not available in Node.js
 */
import { vi } from 'vitest';

// Mock document for DOM operations
const mockDocument = {
  createElement: vi.fn((tag: string) => ({
    style: {},
    classList: { add: vi.fn(), remove: vi.fn() },
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  },
};

if (typeof document === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).document = mockDocument;
}

// Mock window
if (typeof window === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).window = globalThis;
}
