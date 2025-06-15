// src/lib/theme-helpers/formatDate.helper.ts
import { SignumHelper } from './types';

export const formatDateHelper: SignumHelper = () => ({
  /**
   * Formats a date string into a more readable format.
   * @example {{formatDate some.date_string}}
   */
  formatDate: function(dateString: string | Date): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return ''; // Return empty for invalid dates
    }

    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
});