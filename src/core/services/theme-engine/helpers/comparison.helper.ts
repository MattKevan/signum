// src/lib/theme-helpers/comparison.helper.ts
import { SignumHelper } from './types';

// This code is now valid because SignumHelperFunction accepts a boolean return.
export const comparisonHelpers: SignumHelper = () => ({
  eq: (a, b) => a === b,
  gt: (a, b) => a > b,
  lt: (a, b) => a < b,
});