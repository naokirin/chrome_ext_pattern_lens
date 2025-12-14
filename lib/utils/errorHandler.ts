/**
 * Unified error handling utilities
 */

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /** Non-critical errors that can be safely ignored */
  LOW = 'low',
  /** Errors that should be logged but don't break functionality */
  MEDIUM = 'medium',
  /** Critical errors that should be reported to the user */
  HIGH = 'high',
}

/**
 * Custom error class for Pattern Lens
 */
export class PatternLensError extends Error {
  constructor(
    message: string,
    public readonly severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'PatternLensError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PatternLensError);
    }
  }
}

/**
 * Log error with appropriate level based on severity
 */
function logError(error: PatternLensError, context?: string): void {
  const contextPrefix = context ? `[${context}] ` : '';
  const message = `${contextPrefix}${error.message}`;

  if (error.originalError) {
    console.error(message, error.originalError);
  } else {
    console.error(message);
  }
}

/**
 * Handle error based on severity
 * @param error - The error to handle
 * @param context - Optional context information
 * @param onHighSeverity - Callback for high severity errors
 * @returns true if error was handled, false otherwise
 */
export function handleError(
  error: unknown,
  context?: string,
  onHighSeverity?: (error: PatternLensError) => void
): boolean {
  const patternLensError = normalizeError(error);

  // Log all errors in development
  if (process.env.NODE_ENV === 'development' || import.meta.env?.DEV) {
    logError(patternLensError, context);
  }

  // Handle based on severity
  switch (patternLensError.severity) {
    case ErrorSeverity.LOW:
      // Silently ignore low severity errors
      return true;

    case ErrorSeverity.MEDIUM:
      // Log but don't break functionality
      if (process.env.NODE_ENV === 'development' || import.meta.env?.DEV) {
        logError(patternLensError, context);
      }
      return true;

    case ErrorSeverity.HIGH:
      // Call high severity handler if provided
      if (onHighSeverity) {
        onHighSeverity(patternLensError);
      }
      return false;

    default:
      return false;
  }
}

/**
 * Normalize unknown error to PatternLensError
 */
function normalizeError(error: unknown): PatternLensError {
  if (error instanceof PatternLensError) {
    return error;
  }

  if (error instanceof Error) {
    return new PatternLensError(error.message, ErrorSeverity.MEDIUM, error);
  }

  if (typeof error === 'string') {
    return new PatternLensError(error, ErrorSeverity.MEDIUM);
  }

  return new PatternLensError('Unknown error occurred', ErrorSeverity.MEDIUM);
}

/**
 * Create a low severity error (can be safely ignored)
 */
export function createLowSeverityError(message: string, originalError?: Error): PatternLensError {
  return new PatternLensError(message, ErrorSeverity.LOW, originalError);
}

/**
 * Create a medium severity error (should be logged)
 */
export function createMediumSeverityError(message: string, originalError?: Error): PatternLensError {
  return new PatternLensError(message, ErrorSeverity.MEDIUM, originalError);
}

/**
 * Create a high severity error (should be reported to user)
 */
export function createHighSeverityError(message: string, originalError?: Error): PatternLensError {
  return new PatternLensError(message, ErrorSeverity.HIGH, originalError);
}

/**
 * Safely execute a function and handle errors
 * @param fn - Function to execute
 * @param context - Optional context information
 * @param defaultValue - Default value to return on error
 * @returns Result of function or default value on error
 */
export function safeExecute<T>(
  fn: () => T,
  context?: string,
  defaultValue?: T
): T | undefined {
  try {
    return fn();
  } catch (error) {
    handleError(error, context);
    return defaultValue;
  }
}

/**
 * Safely execute an async function and handle errors
 * @param fn - Async function to execute
 * @param context - Optional context information
 * @param defaultValue - Default value to return on error
 * @returns Result of function or default value on error
 */
export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  context?: string,
  defaultValue?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context);
    return defaultValue;
  }
}
