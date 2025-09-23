'use client';

import { useGame } from '../contexts/GameContext';

export default function TestSyncPage() {
  const { games, selectedGame, setSelectedGame, getSelectedGameData } = useGame();
  const selectedGameData = getSelectedGameData();

  return (
    <div className="min-h-screen bg-gray-950 pt-24 md:pt-27">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Test de Synchronisation</h1>

        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Jeu actuellement sélectionné</h2>
          {selectedGameData ? (
            <div className="flex items-center space-x-4">
              <img
                src={selectedGameData.selected_image.url}
                alt={selectedGameData.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
              <div>
                <p className="text-white font-medium">{selectedGameData.name}</p>
                <p className="text-gray-400 text-sm">ID: {selectedGameData.id}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">Aucun jeu sélectionné</p>
          )}
        </div>

        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Actions de test</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {games.slice(0, 6).map((game) => (
              <button
                key={game.id}
                onClick={() => setSelectedGame(game.id.toString())}
                className={`
                  p-4 rounded-lg border-2 transition-all duration-300
                  ${selectedGame === game.id.toString()
                    ? 'border-pink-500 bg-pink-500/10'
                    : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                  }
                `}
              >
                <img
                  src={game.unselected_image.url}
                  alt={game.name}
                  className="w-full h-20 object-cover rounded mb-2"
                />
                <p className="text-white text-sm font-medium">{game.name}</p>
              </button>
            ))}
          </div>

          <button
            onClick={() => setSelectedGame(null)}
            className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Désélectionner tout
          </button>
        </div>

        <div className="mt-8 bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Instructions de test</h2>
          <div className="text-gray-300 space-y-2">
            <p>• Sélectionnez un jeu ici et vérifiez qu'il apparaît dans la navbar</p>
            <p>• Sélectionnez un jeu via la navbar mobile et vérifiez qu'il se met à jour ici</p>
            <p>• Sélectionnez un jeu via le GameSelector desktop et vérifiez la synchronisation</p>
            <p>• Rafraîchissez la page pour tester la persistance localStorage</p>
            <p>• Ouvrez plusieurs onglets pour tester la synchronisation inter-onglets</p>
          </div>
        </div>
      </div>
    </div>
  );
}