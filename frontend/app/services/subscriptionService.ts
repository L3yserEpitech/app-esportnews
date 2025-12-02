import { loadStripe } from '@stripe/stripe-js';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export interface SubscriptionStatus {
  premium: boolean;
  subscription_id?: string;
  customer_id?: string;
  subscription_status?: string;
  subscription_current_period_end?: string;
}

export interface CheckoutSessionResponse {
  session_url: string;
}

export interface PortalURLResponse {
  portal_url: string;
}

class SubscriptionService {
  // Get subscription status for current user
  async getSubscriptionStatus(token: string): Promise<SubscriptionStatus> {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch subscription status: ${response.statusText}`);
    }

    return response.json();
  }

  // Create a checkout session and redirect to Stripe
  async createCheckoutSession(token: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to create checkout session: ${response.statusText}`);
    }

    const data: CheckoutSessionResponse = await response.json();

    // Redirect to Stripe Checkout
    window.location.href = data.session_url;
  }

  // Get customer portal URL
  async getCustomerPortalURL(token: string, returnUrl: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/portal?return_url=${encodeURIComponent(returnUrl)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get portal URL: ${response.statusText}`);
    }

    const data: PortalURLResponse = await response.json();
    return data.portal_url;
  }

  // Open customer portal in a new tab
  async openCustomerPortal(token: string, returnUrl: string): Promise<void> {
    try {
      const portalUrl = await this.getCustomerPortalURL(token, returnUrl);
      window.open(portalUrl, '_blank');
    } catch (error) {
      throw new Error(`Failed to open customer portal: ${error}`);
    }
  }
}

export const subscriptionService = new SubscriptionService();
