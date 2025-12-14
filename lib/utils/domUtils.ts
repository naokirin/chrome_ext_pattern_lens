/**
 * Utility functions for DOM manipulation with type safety
 */

/**
 * Safely get an element by ID with type assertion
 * Returns null if element is not found
 * @param id - The element ID
 * @returns The element if found, or null
 */
export function getElementById<T extends HTMLElement>(
  id: string
): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Safely get a required element by ID with type assertion
 * Throws an error if the element is not found
 * Use this for elements that must exist (e.g., in popup HTML)
 * @param id - The element ID
 * @returns The element if found
 * @throws Error if element is not found
 */
export function getRequiredElementById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Required element with ID "${id}" not found`);
  }
  return element as T;
}
