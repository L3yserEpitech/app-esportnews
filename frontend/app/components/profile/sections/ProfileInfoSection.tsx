'use client';

import { useState } from 'react';
import { User, Mail, Edit } from 'lucide-react';
import ProfileEditModal from '../ProfileEditModal';

interface ProfileInfoSectionProps {
  user: any;
  onUpdate: () => void;
}

export default function ProfileInfoSection({ user, onUpdate }: ProfileInfoSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Section Avatar et Informations */}
      <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-6 pb-6 border-b border-white/10">
        <div className="relative">
          <div className="relative w-20 h-20 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-white/10">
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#182859] to-[#F22E62] flex items-center justify-center">
                <User className="w-10 h-10 text-white/60" />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-lg font-semibold text-white truncate">{user?.name}</h3>
          <p className="text-sm text-gray-400 truncate">{user?.email}</p>
        </div>
      </div>

      {/* Informations du profil (lecture seule) */}
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
            Nom complet
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <div className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
              {user?.name}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
            Adresse email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <div className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
              {user?.email}
            </div>
          </div>
        </div>

        <div className="pt-4">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full py-2.5 bg-[#F22E62] hover:bg-[#F22E62]/80 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" />
            <span>Modifier</span>
          </button>
        </div>
      </div>

      {/* Modal d'édition */}
      <ProfileEditModal
        user={user}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdate={onUpdate}
      />
    </div>
  );
}
