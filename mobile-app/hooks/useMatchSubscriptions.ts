import { useContext } from 'react';
import SubscriptionContext from '@/contexts/SubscriptionContext';

export function useMatchSubscriptions() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useMatchSubscriptions must be used within a SubscriptionProvider');
  }
  return context;
}
