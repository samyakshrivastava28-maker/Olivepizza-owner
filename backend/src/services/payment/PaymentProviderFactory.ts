import { PaymentProvider } from './PaymentProvider.interface.js';
import { razorpayProvider } from './RazorpayProvider.js';
import { phonePeProvider } from './PhonePeProvider.js';
import { cashfreeProvider } from './CashfreeProvider.js';
import { mockSandboxProvider } from './MockSandboxProvider.js';
import { getPaymentConfig } from '../../config/payment.config.js';

export class PaymentProviderFactory {
  private static consecutiveFailures = new Map<string, number>();
  private static circuitBreakerOpen = new Map<string, boolean>();

  public static getProvider(overrideName?: string): PaymentProvider {
    const config = getPaymentConfig();

    // If sandbox mode is explicitly enabled or config is set to mock, return mock
    if (config.sandboxMode && (!overrideName || overrideName === 'mock')) {
      return mockSandboxProvider;
    }

    const targetName = overrideName || config.activeProvider;

    // Check circuit breaker status
    if (this.circuitBreakerOpen.get(targetName)) {
      console.warn(`[CircuitBreaker] Provider "${targetName}" is OPEN (failing). Initiating automatic failover...`);
      return this.getFailoverProvider(targetName);
    }

    switch (targetName) {
      case 'razorpay':
        return razorpayProvider;
      case 'phonepe':
        return phonePeProvider;
      case 'cashfree':
        return cashfreeProvider;
      case 'mock':
      default:
        return mockSandboxProvider;
    }
  }

  public static recordFailure(providerName: string) {
    const current = (this.consecutiveFailures.get(providerName) || 0) + 1;
    this.consecutiveFailures.set(providerName, current);

    const threshold = getPaymentConfig().circuitBreakerThreshold || 5;
    if (current >= threshold) {
      this.circuitBreakerOpen.set(providerName, true);
      console.error(`🔥 [CircuitBreaker] OPENED for provider "${providerName}" after ${current} consecutive failures!`);

      // Auto reset circuit breaker after 5 minutes
      setTimeout(() => {
        this.circuitBreakerOpen.set(providerName, false);
        this.consecutiveFailures.set(providerName, 0);
        console.log(`✅ [CircuitBreaker] CLOSED for provider "${providerName}". Probing recovery...`);
      }, 5 * 60 * 1000);
    }
  }

  public static recordSuccess(providerName: string) {
    this.consecutiveFailures.set(providerName, 0);
    this.circuitBreakerOpen.set(providerName, false);
  }

  private static getFailoverProvider(failedProvider: string): PaymentProvider {
    const chain: Record<string, PaymentProvider> = {
      razorpay: phonePeProvider,
      phonepe: cashfreeProvider,
      cashfree: mockSandboxProvider,
      mock: mockSandboxProvider,
    };
    return chain[failedProvider] || mockSandboxProvider;
  }

  public static getCircuitBreakerStatus(): Record<string, { open: boolean; failures: number }> {
    const providers = ['razorpay', 'phonepe', 'cashfree', 'mock'];
    const result: Record<string, { open: boolean; failures: number }> = {};
    for (const p of providers) {
      result[p] = {
        open: !!this.circuitBreakerOpen.get(p),
        failures: this.consecutiveFailures.get(p) || 0,
      };
    }
    return result;
  }
}
