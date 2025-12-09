'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'

interface UserProfileProps {
  className?: string
}

const UserProfile: React.FC<UserProfileProps> = ({ className = '' }) => {
  const { data: session } = useSession()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const user = session?.user as any

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  if (!session || !user) {
    return null
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2 p-2 rounded-full hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500"
        aria-label="Menu profil"
      >
        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
          {user.image && user.photoUploaded ? (
            <Image
              src={user.image}
              alt={`Photo de profil de ${user.name}`}
              width={32}
              height={32}
              className="object-cover"
            />
          ) : (
            <span className="text-sm font-medium text-white">
              {user.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          )}
        </div>
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
          {/* User Info Header */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
                {user.image && user.photoUploaded ? (
                  <Image
                    src={user.image}
                    alt={`Photo de profil de ${user.name}`}
                    width={48}
                    height={48}
                    className="object-cover"
                  />
                ) : (
                  <span className="text-lg font-medium text-white">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{user.name}</p>
                <p className="text-gray-400 text-sm truncate">{user.email}</p>
                {user.admin && (
                  <span className="inline-block mt-1 px-2 py-1 bg-pink-600 text-white text-xs rounded-full">
                    Admin
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Favorite Team */}
          {user.favorite_team && (
            <div className="p-4 border-b border-gray-700">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Équipe favorite</h4>
              <div className="flex items-center space-x-3">
                {user.favorite_team.image_url && (
                  <div className="w-8 h-8 rounded overflow-hidden">
                    <Image
                      src={user.favorite_team.image_url}
                      alt={user.favorite_team.name}
                      width={32}
                      height={32}
                      className="object-cover"
                    />
                  </div>
                )}
                <div>
                  <p className="text-white text-sm font-medium">{user.favorite_team.name}</p>
                  <p className="text-gray-400 text-xs">{user.favorite_team.acronym}</p>
                </div>
              </div>
            </div>
          )}

          {/* Menu Items */}
          <div className="py-2">
            <a
              href="/profil"
              className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              Mon profil
            </a>
            <a
              href="/parametres"
              className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              Paramètres
            </a>
            {user.admin && (
              <a
                href="/admin/stats"
                className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                Administration
              </a>
            )}
          </div>

          {/* Sign Out */}
          <div className="border-t border-gray-700 p-2">
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors rounded"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserProfile