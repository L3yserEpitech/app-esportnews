'use client';

import Navbar from './Navbar';
import Footer from './Footer';
import { useGame } from '../../contexts/GameContext';

interface ClientLayoutProps {
  children: React.ReactNode;
}

const ClientLayout: React.FC<ClientLayoutProps> = ({ children }) => {
  const { games, selectedGame, setSelectedGame } = useGame();

  return (
    <>
      <Navbar
        games={games}
        selectedGame={selectedGame}
        onGameSelectionChange={setSelectedGame}
      />
      {children}
      <Footer />
    </>
  );
};

export default ClientLayout;