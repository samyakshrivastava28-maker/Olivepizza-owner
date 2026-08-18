import { logDetailedError, translateError } from './errorTranslator';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wraps an authentication function with an exponential backoff retry mechanism.
 * Ideal for 'network-request-failed' scenarios or transient failures.
 * 
 * @param fn The async function to execute.
 * @param context Name of the action (e.g. 'Login', 'Register') for logging.
 * @param maxRetries Maximum number of retries before throwing.
 */
export async function withAuthRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries: number = 3
): Promise<T> {
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    try {
      if (!navigator.onLine) {
        throw new Error("net::err_internet_disconnected");
      }
      return await fn();
    } catch (error: any) {
      const msg = (error.message || error.code || String(error)).toLowerCase();
      
      // Do not retry on definite failures (wrong password, etc.)
      const isTransient = 
        msg.includes('network-request-failed') ||
        msg.includes('timeout') ||
        msg.includes('failed to fetch') ||
        msg.includes('internal-error');

      if (!isTransient || attempt === maxRetries) {
        logDetailedError(error, { context, attempt, isFinal: true });
        // Throw translated error for the UI to display directly
        throw new Error(translateError(error));
      }
      
      // Log the retry internally
      logDetailedError(error, { context, attempt, isFinal: false });
      
      attempt++;
      // Exponential backoff: 500ms, 1000ms, 2000ms
      await delay(Math.pow(2, attempt - 1) * 500);
    }
  }
  
  throw new Error(translateError(new Error("Unknown error")));
}
