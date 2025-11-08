'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Filter } from 'lucide-react';

export interface TournamentFiltersType {
  tiers: string[];
}

interface TournamentFiltersProps {
  filters: TournamentFiltersType;
  onFiltersChange: (filters: TournamentFiltersType) => void;
  className?: string;
}

const TournamentFilters: React.FC<TournamentFiltersProps> = ({
  filters,
  onFiltersChange,
  className = ''
}) => {
  const t = useTranslations();
  const [isExpanded, setIsExpanded] = useState(false);

  // Options des tiers avec couleurs et descriptions
  const tierOptions = useMemo(() => [
    {
      value: 's',
      label: 'Tier S',
      color: 'bg-yellow-500',
      description: t('pages_detail.tournaments.tier_s_description')
    },
    {
      value: 'a',
      label: 'Tier A',
      color: 'bg-blue-500',
      description: t('pages_detail.tournaments.tier_a_description')
    },
    {
      value: 'b',
      label: 'Tier B',
      color: 'bg-green-500',
      description: t('pages_detail.tournaments.tier_b_description')
    },
    {
      value: 'c',
      label: 'Tier C',
      color: 'bg-purple-500',
      description: t('pages_detail.tournaments.tier_c_description')
    },
    {
      value: 'd',
      label: 'Tier D',
      color: 'bg-gray-500',
      description: t('pages_detail.tournaments.tier_d_description')
    }
  ], [t]);


  // Handler pour les tiers
  const handleTierToggle = useCallback((tier: string) => {
    const newTiers = filters.tiers.includes(tier)
      ? filters.tiers.filter(t => t !== tier)
      : [...filters.tiers, tier];

    onFiltersChange({
      ...filters,
      tiers: newTiers
    });
  }, [filters, onFiltersChange]);

  // Handler pour sélectionner tous les tiers
  const handleSelectAllTiers = useCallback(() => {
    const allTiers = tierOptions.map(t => t.value);
    onFiltersChange({
      ...filters,
      tiers: filters.tiers.length === allTiers.length ? [] : allTiers
    });
  }, [filters, onFiltersChange, tierOptions]);

  // Handler pour réinitialiser les filtres
  const handleResetFilters = useCallback(() => {
    onFiltersChange({
      tiers: []
    });
  }, [onFiltersChange]);

  // Compter les filtres actifs
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.tiers.length > 0 && filters.tiers.length < tierOptions.length) count++;
    return count;
  }, [filters, tierOptions.length]);

  return (
    <div className={`bg-gray-800/50 border border-gray-700 rounded-lg ${className}`}>
      {/* Header des filtres */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-3">
          <Filter className="w-5 h-5 text-pink-400" />
          <div>
            <span className="text-white font-medium">{t('pages_detail.tournaments.filters_title')}</span>
            {activeFiltersCount > 0 && (
              <div className="text-xs text-gray-400 mt-0.5">
                {activeFiltersCount} {activeFiltersCount > 1 ? t('pages_detail.tournaments.filter_active_plural') : t('pages_detail.tournaments.filter_active_singular')}
              </div>
            )}
          </div>
          {activeFiltersCount > 0 && (
            <div className="px-2 py-1 bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs rounded-full font-medium">
              {activeFiltersCount}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700/50 border border-gray-600 hover:border-gray-500"
            >
              {t('pages_detail.tournaments.reset_button')}
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isExpanded
                ? 'text-pink-400 bg-pink-500/10 border border-pink-500/30'
                : 'text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500'
            }`}
            title={isExpanded ? t('pages_detail.tournaments.hide_filters') : t('pages_detail.tournaments.show_filters')}
          >
            <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      {/* Contenu des filtres */}
      <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4">
          {/* Filtres par tier */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-300">
                {t('pages_detail.tournaments.tier_label')}
              </label>
              <button
                onClick={handleSelectAllTiers}
                className="text-xs text-pink-400 hover:text-pink-300 transition-colors font-medium"
              >
                {filters.tiers.length === tierOptions.length ? t('pages_detail.tournaments.uncheck_all') : t('pages_detail.tournaments.check_all')}
              </button>
            </div>

            {/* Option "Tous les tiers" - plus compacte */}
            <div className="mb-3">
              <label className="flex items-center p-2 rounded border border-gray-600 bg-gray-700/30 hover:bg-gray-700/50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.tiers.length === 0}
                  onChange={() => onFiltersChange({ tiers: [] })}
                  className="w-3 h-3 text-pink-500 bg-gray-700 border-gray-600 rounded focus:ring-pink-500 focus:ring-1"
                />
                <div className="ml-2 flex items-center">
                  <div className="flex space-x-0.5 mr-2">
                    {tierOptions.map((tier) => (
                      <div key={tier.value} className={`w-1.5 h-1.5 rounded-full ${tier.color}`} />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-white">{t('pages_detail.tournaments.all_tiers')}</span>
                </div>
              </label>
            </div>

            {/* Options individuelles - version compacte en grille */}
            <div className="grid grid-cols-2 gap-1.5">
              {tierOptions.map((tier) => {
                const isSelected = filters.tiers.includes(tier.value);
                return (
                  <label
                    key={tier.value}
                    className={`
                      flex items-center p-2 rounded border transition-all duration-200 cursor-pointer text-xs
                      ${isSelected
                        ? 'border-pink-500/50 bg-pink-500/10 text-white'
                        : 'border-gray-600 bg-gray-700/30 hover:bg-gray-700/50 text-gray-300'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleTierToggle(tier.value)}
                      className="w-3 h-3 text-pink-500 bg-gray-700 border-gray-600 rounded focus:ring-pink-500 focus:ring-1"
                    />
                    <div className={`w-3 h-3 rounded-full ${tier.color} mx-2 flex-shrink-0`} />
                    <span className="font-medium truncate">{tier.label}</span>
                  </label>
                );
              })}
            </div>

            {/* Résumé compact */}
            {filters.tiers.length > 0 && (
              <div className="mt-3 p-2 bg-gray-800/30 border border-gray-600/50 rounded text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">
                    <span className="text-white font-medium">{filters.tiers.length}</span> {filters.tiers.length > 1 ? t('pages_detail.tournaments.selected_plural') : t('pages_detail.tournaments.selected_singular')}
                  </span>
                  <div className="flex space-x-1">
                    {filters.tiers.slice(0, 5).map(tierValue => {
                      const tier = tierOptions.find(t => t.value === tierValue);
                      return tier ? (
                        <div
                          key={tierValue}
                          className={`w-2 h-2 rounded-full ${tier.color}`}
                          title={tier.label}
                        />
                      ) : null;
                    })}
                    {filters.tiers.length > 5 && (
                      <span className="text-gray-400 ml-1">+{filters.tiers.length - 5}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentFilters;