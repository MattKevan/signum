// src/lib/theme-helpers/index.ts
// ... (other helper imports)
import { queryHelper } from './query.helper';
import { comparisonHelpers } from './comparison.helper';
import { markdownHelper } from './markdown.helper';
import { strUtilHelper } from './strUtil.helper';
import { formatDateHelper } from './formatDate.helper';
import { pagerHelper } from './pager.helper';
import { SignumHelper } from './types';
import { getUrlHelper } from './getUrl.helper';
import { assignHelper } from './assign.helper';
import { imageHelper } from './image.helper';
import { concatHelper } from './concat.helper';
import { imageUrlHelper } from './imageUrl.helper';
import { renderLayoutHelper } from './renderLayout.helper';
import { renderItemHelper } from './renderItem.helper';

export const coreHelpers: SignumHelper[] = [
  queryHelper,
  strUtilHelper,
  formatDateHelper,
  comparisonHelpers,
  markdownHelper,
  renderItemHelper, 
  pagerHelper,
  getUrlHelper,
  assignHelper,
  imageHelper,
  concatHelper,
  imageUrlHelper,
  renderLayoutHelper
];