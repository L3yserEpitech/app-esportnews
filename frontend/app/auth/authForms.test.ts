import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import LoginPage from './login/page';
import RegisterPage from './register/page';
import ForgotPasswordPage from './forgot-password/page';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'fr' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, back: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));
vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => ({ login: async () => {}, signup: async () => {}, isAuthenticated: false, isLoading: false }),
}));
vi.mock('@/app/components/common/DynamicLogo', () => ({ default: () => null }));

// Sent before hydration, a form with no method is a native GET: the password
// lands in the address, the history, the host's logs and page_views.
describe.each<[string, ComponentType]>([
  ['login', LoginPage],
  ['register', RegisterPage],
  ['forgot-password', ForgotPasswordPage],
])('%s form in the server render', (_name, Page) => {
  const html = renderToString(createElement(Page));

  it('never submits as a GET', () => {
    const form = html.match(/<form[^>]*>/)?.[0] ?? '';
    expect(form).toMatch(/method="post"/i);
  });

  it('cannot be submitted until React has taken over', () => {
    const button = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? '';
    expect(button).toMatch(/\sdisabled(=""|\s|>)/);
  });
});
