'use client';

import { useState, useCallback, useMemo } from 'react';

interface CalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  className?: string;
}

const Calendar: React.FC<CalendarProps> = ({
  selectedDate,
  onDateSelect,
  className = ''
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const getDaysInMonth = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Commencer par lundi (1) au lieu de dimanche (0)
    let firstDayOfWeek = firstDay.getDay();
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const days: (Date | null)[] = [];

    // Ajouter les jours vides du début
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    // Ajouter tous les jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  }, []);

  const days = useMemo(() => getDaysInMonth(currentMonth), [currentMonth, getDaysInMonth]);

  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  }, []);

  const isToday = useCallback((date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }, []);

  const isSelected = useCallback((date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  }, [selectedDate]);

  const handleDateClick = useCallback((date: Date) => {
    onDateSelect(date);
  }, [onDateSelect]);

  return (
    <div className={`bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden ${className}`}>
      {/* En-tête du calendrier */}
      <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/40 px-6 py-4 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 text-gray-400 hover:text-pink-400 transition-all duration-200 hover:bg-gray-700/30 rounded-lg"
            aria-label="Mois précédent"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h3 className="text-lg font-bold text-white">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>

          <button
            onClick={() => navigateMonth('next')}
            className="p-2 text-gray-400 hover:text-pink-400 transition-all duration-200 hover:bg-gray-700/30 rounded-lg"
            aria-label="Mois suivant"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-6 pb-6">
        {/* Noms des jours */}
        <div className="grid grid-cols-7 gap-1 mb-3 pt-4">
          {dayNames.map((dayName) => (
            <div
              key={dayName}
              className="text-center text-xs font-semibold text-gray-400 py-2 uppercase tracking-wider"
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* Grille des jours */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => (
            <div key={index} className="aspect-square">
              {day ? (
                <button
                  onClick={() => handleDateClick(day)}
                  className={`
                    w-full h-full rounded-lg text-sm font-semibold transition-all duration-200 relative overflow-hidden
                    ${isSelected(day)
                      ? 'bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-lg shadow-pink-500/25 scale-95'
                      : isToday(day)
                      ? 'bg-gradient-to-br from-pink-500/20 to-pink-600/10 text-pink-400 border border-pink-500/50 shadow-md'
                      : 'text-gray-300 hover:bg-gray-700/50 hover:text-white hover:scale-95'
                    }
                  `}
                  aria-label={`Sélectionner le ${day.getDate()} ${monthNames[day.getMonth()]}`}
                >
                  <span className="relative z-10">{day.getDate()}</span>
                  {isSelected(day) && (
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                  )}
                </button>
              ) : (
                <div className="w-full h-full" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Calendar;