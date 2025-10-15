import { afterEach, beforeAll, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

beforeAll(() => {
  console.log('Test suite starting...');
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  console.log('Test suite completed');
});
