import { SignumHelper } from './types';
import { HelperOptions } from 'handlebars';

export const assignHelper: SignumHelper = () => ({
  /**
   * A Handlebars helper to add a new property to an object's context.
   * Useful for augmenting data inside a loop.
   * This version uses generics for full type safety.
   *
   * @template T The type of the `this` context.
   * @template K The type of the object being extended.
   * @template V The type of the value being added.
   */
  assign: function<T, K extends object, V>(
    this: T,
    object: K,
    key: string,
    value: V,
    options: HelperOptions,
  ): string {
    // Create a new object by spreading the original and adding the new key-value pair.
    const newContext = { ...object, [key]: value };

    // Execute the inner block of the helper with the new, augmented context.
    return options.fn(newContext);
  },
});