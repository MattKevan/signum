// src/lib/theme-helpers/index.ts
// ... (other helper imports)
import { renderViewHelper } from './renderView.helper';
import { queryHelper } from './query.helper';
import { comparisonHelpers } from './comparison.helper';
import { renderLayoutForItemHelper } from './renderLayoutForItem.helper';
import { markdownHelper } from './markdown.helper';
import { strUtilHelper } from './strUtil.helper';
import { formatDateHelper } from './formatDate.helper';
import { SignumHelper } from './types';
 
export const coreHelpers: SignumHelper[] = [
  queryHelper,
  strUtilHelper,
  formatDateHelper,
  comparisonHelpers,
  markdownHelper,
  renderViewHelper, 
  renderLayoutForItemHelper, 
];