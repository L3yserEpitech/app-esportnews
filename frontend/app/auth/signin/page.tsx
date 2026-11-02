import { permanentRedirect } from 'next/navigation';

// next-auth has no route here: the form that lived on this URL ended on /api/auth/error.
export default function SignInPage() {
  permanentRedirect('/auth/login');
}
