import React, { useState, useCallback, useMemo, useEffect } from 'react';
import MenuScreen from './components/MenuScreen';
import GameScreen from './components/GameScreen';
import { GameState } from './types';
import type { GeneratedCharacters, CharacterProfile } from './types';
import Button from './components/ui/Button';
import { audioService } from './services/audioService';
import GradientMenu, { MenuItem } from './components/ui/gradient-menu';
import { IoHomeOutline, IoVolumeMuteOutline, IoVolumeHighOutline, IoExpandOutline, IoContractOutline } from 'react-icons/io5';


const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [characterData, setCharacterData] = useState<{characters: GeneratedCharacters, hero: CharacterProfile} | null>(null);
  const [finalScore, setFinalScore] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  const handleStartGame = useCallback((generatedCharacters: GeneratedCharacters, hero: CharacterProfile) => {
    setCharacterData({ characters: generatedCharacters, hero });
    setGameState(GameState.PLAYING);
  }, []);

  const handleGameOver = useCallback((score: number) => {
    audioService.stopMusic();
    audioService.playMusic('music_menu');
    setFinalScore(score);
    setGameState(GameState.GAME_OVER);
  }, []);
  
  const handleRestart = useCallback(() => {
      setFinalScore(0);
      setCharacterData(null);
      setGameState(GameState.MENU);
  }, []);

  const handleMuteToggle = () => {
      const newMuteState = audioService.toggleMute();
      setIsMuted(newMuteState);
  }

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const menuItems = useMemo((): MenuItem[] => [
    {
      title: 'Home',
      icon: <IoHomeOutline />,
      gradientFrom: '#a955ff',
      gradientTo: '#ea51ff',
      onClick: handleRestart,
      disabled: gameState === GameState.MENU,
    },
    {
      title: isMuted ? 'Unmute' : 'Mute',
      icon: isMuted ? <IoVolumeMuteOutline /> : <IoVolumeHighOutline />,
      gradientFrom: '#56CCF2',
      gradientTo: '#2F80ED',
      onClick: handleMuteToggle,
    },
    {
      title: isFullscreen ? 'Exit Full' : 'Fullscreen',
      icon: isFullscreen ? <IoContractOutline /> : <IoExpandOutline />,
      gradientFrom: '#FFD700',
      gradientTo: '#FFA500',
      onClick: handleToggleFullscreen,
    },
  ], [gameState, isMuted, isFullscreen, handleRestart, handleMuteToggle, handleToggleFullscreen]);

  const renderContent = () => {
    switch (gameState) {
      case GameState.PLAYING:
        if (!characterData) return null;
        return <GameScreen characters={characterData.characters} startingHero={characterData.hero} onGameOver={handleGameOver} />;
      case GameState.GAME_OVER:
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 text-center">
                <h1 className="text-6xl text-red-600 uppercase mb-4">Game Over</h1>
                <p className="text-3xl text-yellow-400 mb-8">Final Score: {finalScore}</p>
                <Button onClick={handleRestart}>Return to Menu</Button>
            </div>
        );
      case GameState.MENU:
      default:
        return <MenuScreen onStartGame={handleStartGame} />;
    }
  };

  return (
    <React.Fragment>
      {renderContent()}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
        <GradientMenu items={menuItems} />
      </div>
    </React.Fragment>
  );
};

export default App;