"use client";

import { useGame } from "@/app/contexts/GameContext";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Radix Select refuses an empty-string item value, hence a sentinel for "no game".
const NONE = "none";

interface GameSelectProps {
  value: number | null;
  onChange: (gameId: number | null) => void;
}

export function GameSelect({ value, onChange }: GameSelectProps) {
  const { games, isLoadingGames } = useGame();

  return (
    <div>
      <Label htmlFor="game" className="text-gray-300 mb-2">Jeu</Label>
      <Select
        value={value === null ? NONE : String(value)}
        onValueChange={(v) => onChange(v === NONE ? null : Number(v))}
        disabled={isLoadingGames}
      >
        <SelectTrigger id="game" className="w-full bg-[#060B13] border-[#182859] text-white">
          <SelectValue placeholder={isLoadingGames ? "Chargement des jeux..." : "Aucun jeu"} />
        </SelectTrigger>
        <SelectContent className="bg-[#091626] border-[#182859]">
          <SelectItem value={NONE} className="text-gray-400 hover:bg-[#182859]">
            Aucun jeu
          </SelectItem>
          {games.map((game) => (
            <SelectItem
              key={game.id}
              value={String(game.id)}
              className="text-white hover:bg-[#182859]"
            >
              {game.full_name || game.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1 text-xs text-gray-500">
        Associe l&apos;article à un jeu (optionnel).
      </p>
    </div>
  );
}
