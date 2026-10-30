import { Barlow, Barlow_Condensed } from 'next/font/google';

// Typefaces of the Claude Design app mockups (promo modal and top banner) only.
export const barlow = Barlow({ subsets: ['latin'], weight: ['400', '600', '700'], display: 'swap' });
export const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  style: ['normal', 'italic'],
  display: 'swap',
});
export const CONDENSED = barlowCondensed.style.fontFamily;
