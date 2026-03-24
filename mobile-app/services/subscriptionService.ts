import apiClient from './apiClient';
import { Platform } from 'react-native';

interface ValidateIAPResponse {
  premium: boolean;
  iap_platform: string;
  iap_expires_at?: string;
  message: string;
}

class SubscriptionService {
  /**
   * Validate an IAP receipt with the backend.
   * Called after a successful purchase or restore to sync premium status server-side.
   */
  async validateReceipt(params: {
    transactionId?: string;
    productId: string;
    purchaseToken?: string;
  }): Promise<ValidateIAPResponse> {
    const response = await apiClient.post<ValidateIAPResponse>(
      '/api/subscriptions/iap/validate',
      {
        platform: Platform.OS,
        transaction_id: params.transactionId || '',
        product_id: params.productId,
        purchase_token: params.purchaseToken || '',
      }
    );
    return response.data;
  }
}

export const subscriptionService = new SubscriptionService();
