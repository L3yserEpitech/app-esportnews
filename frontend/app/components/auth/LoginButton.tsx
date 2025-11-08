'use client'

import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'

interface LoginButtonProps {
  className?: string
}

const LoginButton: React.FC<LoginButtonProps> = ({ className = '' }) => {
  const t = useTranslations()
  const handleLogin = () => {
    signIn(undefined, { callbackUrl: '/' })
  }

  return (
    <button
      onClick={handleLogin}
      className={`
        px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg
        transition-colors duration-200 font-medium text-sm
        focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 focus:ring-offset-gray-950
        ${className}
      `}
    >
      {t('pages.login.se_connecter')}
    </button>
  )
}

export default LoginButton