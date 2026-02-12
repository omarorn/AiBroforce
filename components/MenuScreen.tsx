
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { GeneratedCharacters, CharacterProfile, SavedCast, HighScore, Difficulty } from '../types';
import { generateCharacters, generateCharacterImage, generateMissionBriefing } from '../services/geminiService';
import { audioService } from '../services/audioService';
import { storageService } from '../services/storageService';
import Button from './ui/Button';
import Input from './ui/Input';
import RotatingLoader from './ui/RotatingLoader';
import CharacterProfileScreen from './CharacterProfileScreen';
import CharacterCard from './ui/CharacterCard';
import ConsoleLog from './ui/ConsoleLog';

interface MenuScreenProps {
  onStartGame: (characters: GeneratedCharacters, startingHero: CharacterProfile, castName: string, difficulty: Difficulty) => void;
}

type View = 'generate' | 'recruiting' | 'review' | 'edit_character' | 'war_room' | 'briefing';

const themeSuggestions = [
  'famous action movie',
  'cheesy 90s cartoon',
  'epic fantasy novel',
  'cyberpunk video game',
  'classic comic book',
  'spaghetti western',
  'kaiju monster movie',
  'saturday morning cartoon',
];

const getRandomTheme = () => {
    const randomPart = themeSuggestions[Math.floor(Math.random() * themeSuggestions.length)];
    return `Silly doppelgangers of ${randomPart} heroes and villains`;
};

const MenuScreen: React.FC<MenuScreenProps> = ({ onStartGame }) => {
  const [view, setView] = useState<View>('generate');
  
  // State for Generation Process
  const [theme, setTheme] = useState<string>(getRandomTheme());
  const [characterCount, setCharacterCount] = useState<number>(4);
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  
  // Final Data
  const [characters, setCharacters] = useState<GeneratedCharacters | null>(null);
  
  // Recruiting State (Lineup)
  const [recruitedHeroes, setRecruitedHeroes] = useState<CharacterProfile[]>([]);
  const [recruitedVillains, setRecruitedVillains] = useState<CharacterProfile[]>([]);
  const [currentRecruitingId, setCurrentRecruitingId] = useState<number | null>(null);
  const [cachedImages, setCachedImages] = useState<string[]>([]);

  // Edit/Manage State
  const [editingCharacter, setEditingCharacter] = useState<CharacterProfile | null>(null);
  const [savedCasts, setSavedCasts] = useState<SavedCast[]>([]);
  const [heroPool, setHeroPool] = useState<CharacterProfile[]>([]);
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [currentCastName, setCurrentCastName] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const saveInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  
  // War Room State
  const [warRoomTab, setWarRoomTab] = useState<'squads' | 'barracks' | 'leaderboard'>('squads');
  const [selectedDraftHeroes, setSelectedDraftHeroes] = useState<CharacterProfile[]>([]);

  useEffect(() => {
    const loadData = async () => {
        setSavedCasts(await storageService.loadCasts());
        setCachedImages(await storageService.getAllCharacterImages());
        setHighScores(await storageService.getHighScores());
        setHeroPool(await storageService.loadPool('hero'));
    };
    loadData();
  }, [view, warRoomTab]); 

  const addLog = (msg: string) => setConsoleLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

  const startRecruitment = async () => {
    if (!theme.trim()) return;
    setView('recruiting');
    setConsoleLogs([]);
    setRecruitedHeroes([]);
    setRecruitedVillains([]);
    addLog(`INITIALIZING RECRUITMENT PROTOCOL...`);
    addLog(`THEME: ${theme}`);
    addLog(`TARGET SQUAD SIZE: ${characterCount}`);

    try {
        // 1. Generate Text
        addLog(`CONTACTING GEMINI HQ FOR DOSSIERS...`);
        const data = await generateCharacters(theme, characterCount);
        addLog(`DOSSIERS RECEIVED. ${data.heroes.length} HEROES, ${data.villains.length} VILLAINS.`);
        
        // 2. Initialize placeholders (This shows the names immediately in the UI)
        setRecruitedHeroes(data.heroes); 
        setRecruitedVillains(data.villains);
        
        // Log the names so the user sees them "deciding"
        data.heroes.forEach(h => addLog(`IDENTIFIED HERO: ${h.name} - ${h.weaponType}`));
        data.villains.forEach(v => addLog(`IDENTIFIED THREAT: ${v.name}`));

        const allChars = [...data.heroes, ...data.villains];
        const fullyRecruited: CharacterProfile[] = [];
        let quotaExceeded = false;

        // 3. Sequential Image Generation (The Lineup)
        for (const char of allChars) {
            if (quotaExceeded) {
                 addLog(`SKIPPING IMAGE GEN FOR ${char.name} (QUOTA EXCEEDED)`);
                 fullyRecruited.push(char);
                 continue;
            }

            setCurrentRecruitingId(char.id);
            addLog(`GENERATING VISUALS FOR: ${char.name.toUpperCase()}...`);
            
            try {
                const imageUrl = await generateCharacterImage(char);
                addLog(`VISUALS ACQUIRED FOR ${char.name}.`);
                
                // Update specific character in state to trigger re-render
                const updatedChar = { ...char, imageUrl };
                
                if (data.heroes.find(h => h.id === char.id)) {
                    setRecruitedHeroes(prev => prev.map(h => h.id === char.id ? updatedChar : h));
                    audioService.playSound('powerup');
                } else {
                    setRecruitedVillains(prev => prev.map(v => v.id === char.id ? updatedChar : v));
                    audioService.playSound('shoot_shotgun');
                }
                fullyRecruited.push(updatedChar);

            } catch (err: any) {
                addLog(`ERROR GENERATING IMAGE FOR ${char.name}: ${err.message || err}`);
                
                if (err.message && (err.message.includes('Quota Exceeded') || err.message.includes('429'))) {
                    quotaExceeded = true;
                    addLog(`CRITICAL: API QUOTA EXCEEDED. SWITCHING TO TEXT-ONLY MODE.`);
                }
                
                fullyRecruited.push(char); // Keep character even if image fails
            }
        }

        addLog(`RECRUITMENT COMPLETE.`);
        
        // 3.5 Auto-Save to Pool
        const finalHeroes = fullyRecruited.filter(c => data.heroes.some(h => h.id === c.id));
        const finalVillains = fullyRecruited.filter(c => data.villains.some(v => v.id === c.id));
        
        addLog(`ARCHIVING ASSETS TO BARRACKS...`);
        await storageService.saveToPool(finalHeroes, 'hero');
        await storageService.saveToPool(finalVillains, 'villain');

        // 4. Mission Briefing Sequence (Skydiving)
        setView('briefing');
        audioService.playSound('dash'); // Whoosh sound for transition

        // Minimum animation time of 4 seconds so user sees the skydiving
        const animationDelay = new Promise(resolve => setTimeout(resolve, 5000));
        const briefingPromise = generateMissionBriefing({ heroes: finalHeroes, villains: finalVillains });

        // Wait for both animation time and API call
        const [_, briefing] = await Promise.all([animationDelay, briefingPromise]);

        const finalData = { 
            heroes: finalHeroes, 
            villains: finalVillains,
            missionBriefing: briefing
        };

        setCharacters(finalData);
        setView('review');

    } catch (e: any) {
        addLog(`CRITICAL ERROR: ${e.message}`);
        setError(e.message);
    }
  };

  const handleLaunchGame = () => {
    if (!characters || characters.heroes.length === 0) return;
    const startingHero = characters.heroes[Math.floor(Math.random() * characters.heroes.length)];
    onStartGame(characters, startingHero, currentCastName || "Unnamed Squad", difficulty);
  };

  const handleEditSavedCharacter = (char: CharacterProfile, castName: string) => {
      const cast = savedCasts.find(c => c.name === castName);
      if(cast) {
          setCharacters(cast.characters);
          setCurrentCastName(cast.name);
          setEditingCharacter(char);
          setView('edit_character');
      }
  };

  const handleEditCharacter = (char: CharacterProfile) => {
    setEditingCharacter(char);
    setView('edit_character');
  };

  const handleSaveCharacter = async (updatedChar: CharacterProfile) => {
    // Save to pool first (updates the "Barracks" version)
    await storageService.saveToPool([updatedChar], 'hero'); // Just re-save, it dedupes or puts to top
    
    if (!characters) return;
    const newCharacters: GeneratedCharacters = JSON.parse(JSON.stringify(characters));
    const heroIndex = newCharacters.heroes.findIndex(c => c.id === updatedChar.id);
    if(heroIndex > -1) {
        newCharacters.heroes[heroIndex] = updatedChar;
    } else {
        const villainIndex = newCharacters.villains.findIndex(c => c.id === updatedChar.id);
        if(villainIndex > -1) {
            newCharacters.villains[villainIndex] = updatedChar;
        }
    }
    setCharacters(newCharacters);
    if (currentCastName) {
        await storageService.saveCast(currentCastName, newCharacters);
        setSavedCasts(await storageService.loadCasts());
    }
    
    setView('review');
    setEditingCharacter(null);
  };
  
  const handleSaveNewCast = async (name: string) => {
      if(characters && name.trim()) {
          await storageService.saveCast(name.trim(), characters);
          setCurrentCastName(name.trim());
          setSavedCasts(await storageService.loadCasts());
          setIsSaveModalOpen(false);
      }
  };

  const handleLoadCast = (cast: SavedCast) => {
      setCharacters(cast.characters);
      setCurrentCastName(cast.name);
      setView('review');
  };
  
  const handleDeleteCast = async (name: string) => {
      if(window.confirm(`Are you sure you want to delete the cast "${name}"?`)){
        await storageService.deleteCast(name);
        setSavedCasts(await storageService.loadCasts());
      }
  };

  // --- Barracks Draft Logic ---
  const toggleDraftHero = (hero: CharacterProfile) => {
      setSelectedDraftHeroes(prev => {
          if (prev.find(h => h.id === hero.id)) {
              return prev.filter(h => h.id !== hero.id);
          }
          if (prev.length >= 4) {
              audioService.playTone(150, 'sawtooth', 0.1); // Error buzzer
              return prev;
          }
          audioService.playTone(400, 'square', 0.05); // Select blip
          return [...prev, hero];
      });
  };

  const handleDeployDraft = async () => {
      if (selectedDraftHeroes.length === 0) return;
      
      // Get random villains from pool to fight against
      let villains = await storageService.getRandomVillainsFromPool(selectedDraftHeroes.length);
      
      // If no villains in pool (first run?), create placeholders
      if (villains.length === 0) {
          villains = [{
              id: 999, name: "Generic Baddie", description: "Cannon fodder", 
              weaponType: "Pistol", specialAbility: "None", movementAbility: "None", catchphrase: "Bleagh!"
          }];
      }

      // Generate a quick briefing
      const briefing = await generateMissionBriefing({ heroes: selectedDraftHeroes, villains });
      
      const newCastData = {
          heroes: selectedDraftHeroes,
          villains: villains,
          missionBriefing: briefing
      };
      
      setCharacters(newCastData);
      setCurrentCastName(`Custom Squad ${new Date().toLocaleDateString()}`);
      setView('review');
  };

  const handleDeleteHeroFromPool = async (id: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if(window.confirm("Discharge this soldier permanently?")) {
          await storageService.deleteCharacterFromPool(id, 'hero');
          setHeroPool(await storageService.loadPool('hero'));
      }
  };

  // --- Render Functions ---

  const renderGenerate = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-5xl md:text-6xl text-yellow-400 drop-shadow-[4px_4px_0_#9A3412] mb-4 font-bold tracking-tighter">AI BROFORCE</h1>
        <h2 className="text-xl md:text-2xl bg-gray-700 text-white inline-block px-4 py-1 mb-8 transform -skew-x-12 border-2 border-white">RECHARGED</h2>
        
        <div className="bg-gray-800/80 p-8 border-4 border-gray-600 max-w-4xl w-full backdrop-blur-sm shadow-2xl">
            <div className="flex flex-col gap-6">
                <div>
                    <label className="block text-left text-yellow-400 mb-2 uppercase text-sm">Operation Theme</label>
                    <div className="flex gap-2">
                        <Input 
                            type="text" 
                            value={theme} 
                            onChange={(e) => setTheme(e.target.value)} 
                            placeholder="e.g. 80s Action Stars"
                            className="flex-grow"
                        />
                        <Button onClick={() => setTheme(getRandomTheme())} className="!py-2 text-sm !bg-blue-600">Random</Button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 flex items-center justify-between bg-black/30 p-4 rounded">
                        <label className="text-white uppercase text-sm">Squad Size</label>
                        <div className="flex items-center gap-4">
                            <input 
                                type="range" 
                                min="1" 
                                max="8" 
                                value={characterCount} 
                                onChange={(e) => setCharacterCount(parseInt(e.target.value))} 
                                className="w-24 md:w-32 accent-yellow-400"
                            />
                            <span className="text-2xl text-yellow-400 font-bold w-8">{characterCount}</span>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-between bg-black/30 p-4 rounded">
                         <label className="text-white uppercase text-sm">Difficulty</label>
                         <div className="flex gap-1">
                            {(['EASY', 'NORMAL', 'HARD'] as Difficulty[]).map(level => (
                                <button 
                                    key={level}
                                    onClick={() => setDifficulty(level)}
                                    className={`px-2 py-1 text-xs font-bold uppercase transition-colors border ${
                                        difficulty === level 
                                        ? 'bg-yellow-500 text-black border-yellow-500' 
                                        : 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-400'
                                    }`}
                                >
                                    {level}
                                </button>
                            ))}
                         </div>
                    </div>
                </div>

                <Button onClick={startRecruitment} className="!text-2xl !py-6 !bg-green-600 hover:!bg-green-500 hover:scale-[1.02] shadow-[0_4px_0_#14532d] active:shadow-none active:translate-y-1">
                    INITIATE RECRUITMENT
                </Button>
            </div>
             
            <div className="mt-8 pt-6 border-t border-gray-600">
                <Button onClick={() => setView('war_room')} className="!bg-purple-700 !text-sm w-full uppercase font-bold tracking-widest border-2 border-purple-500 hover:!bg-purple-600">
                    Enter War Room
                </Button>
            </div>
        </div>
    </div>
  );

  const renderRecruiting = () => (
      <div className="flex flex-col h-screen p-4 gap-4">
          {/* Top Half: Console & Status */}
          <div className="flex-grow basis-1/3 flex gap-4 min-h-0">
               <div className="flex-grow h-full">
                   <ConsoleLog logs={consoleLogs} />
               </div>
               <div className="w-1/3 h-full bg-gray-800 border-2 border-gray-600 p-4 flex flex-col items-center justify-center">
                    {currentRecruitingId ? (
                        <div className="text-center w-full h-full flex flex-col items-center justify-center">
                            <RotatingLoader images={cachedImages} size="lg" className="mb-4" />
                            <p className="text-yellow-400 text-xs animate-pulse">PROCESSING DNA...</p>
                        </div>
                    ) : (
                        <div className="text-green-500 text-4xl">✓</div>
                    )}
               </div>
          </div>

          {/* Bottom Half: The Lineup */}
          <div className="basis-2/3 bg-gray-800/50 border-t-4 border-yellow-500 p-4 overflow-x-auto flex flex-col">
              <h3 className="text-white mb-2 uppercase text-xs tracking-widest">Recruited Assets</h3>
              <div className="flex gap-4 items-end h-full">
                  {/* Heroes */}
                  {recruitedHeroes.map((hero, idx) => (
                      <div key={`h-${idx}`} className={`transition-all duration-500 ${hero.imageUrl ? 'opacity-100 translate-y-0' : 'opacity-100 translate-y-0 grayscale'}`}>
                          <CharacterCard character={hero} small savedImages={cachedImages} />
                      </div>
                  ))}
                  <div className="w-px h-32 bg-gray-500 mx-4"></div>
                   {/* Villains */}
                   {recruitedVillains.map((villain, idx) => (
                      <div key={`v-${idx}`} className={`transition-all duration-500 ${villain.imageUrl ? 'opacity-100 translate-y-0' : 'opacity-100 translate-y-0 grayscale'}`}>
                          <CharacterCard character={villain} small savedImages={cachedImages} />
                      </div>
                  ))}
              </div>
          </div>
      </div>
  );

  const renderBriefing = () => (
      <div className="fixed inset-0 bg-blue-500 overflow-hidden flex flex-col items-center justify-center z-50">
          {/* Wind lines / Speed effect */}
          <div className="absolute inset-0 opacity-30 bg-sky-scrolling"></div>
          
          <h2 className="text-4xl text-white font-bold uppercase drop-shadow-[4px_4px_0_rgba(0,0,0,0.5)] mb-12 animate-pulse z-10 tracking-wider">Deploying Squad...</h2>
          
          <div className="flex gap-8 z-10">
              {recruitedHeroes.map((hero, i) => (
                  <div key={hero.id} className="relative animate-tumble" style={{animationDelay: `${i * 0.3}s`}}>
                      <div className="w-32 h-40 bg-gray-800 border-4 border-white p-2 transform rotate-2 shadow-2xl flex flex-col items-center">
                          {hero.imageUrl ? (
                             <img src={hero.imageUrl} className="w-full h-full object-cover pixel-art" style={{imageRendering: 'pixelated'}} />
                          ) : (
                             <div className="w-full h-full bg-gray-700"></div>
                          )}
                          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-yellow-300 text-[10px] px-2 py-1 whitespace-nowrap border border-white">
                              {hero.name}
                          </div>
                      </div>
                      {/* Wind streaks */}
                      <div className="absolute -top-12 left-1/2 w-0.5 h-16 bg-white/40 -translate-x-1/2"></div>
                      <div className="absolute -top-8 left-1/3 w-0.5 h-10 bg-white/40 -translate-x-1/2"></div>
                      <div className="absolute -top-10 left-2/3 w-0.5 h-12 bg-white/40 -translate-x-1/2"></div>
                  </div>
              ))}
          </div>

          <div className="absolute bottom-10 z-20">
              <div className="bg-black/70 border-2 border-green-500 text-green-400 font-mono text-xs p-4 rounded shadow-lg">
                <span className="animate-pulse">_ RECEIVING MISSION DATA ENCRYPTED PACKET...</span>
              </div>
          </div>
      </div>
  );

  const renderReview = () => {
      if(!characters) return null;
      return (
        <div className="min-h-screen p-4 flex flex-col overflow-y-auto">
            <div className="max-w-7xl mx-auto w-full">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-gray-800 p-4 border-b-4 border-yellow-500">
                    <div>
                        <h2 className="text-3xl text-yellow-400 uppercase font-bold">{currentCastName || 'UNNAMED SQUAD'}</h2>
                        <div className="flex gap-2 text-xs text-gray-400 mt-1 uppercase font-bold tracking-widest">
                            <span className="bg-gray-700 px-2 py-1 rounded">Difficulty: {difficulty}</span>
                            <span className="bg-gray-700 px-2 py-1 rounded">Ready for deployment</span>
                        </div>
                    </div>
                    <div className="flex gap-4 mt-4 md:mt-0">
                         <Button onClick={() => setIsSaveModalOpen(true)} className="!bg-blue-600 !py-2 !text-sm">Save Squad</Button>
                         <Button onClick={handleLaunchGame} className="!bg-red-600 !py-3 !text-lg animate-pulse">DEPLOY MISSION</Button>
                    </div>
                </div>

                <div className="bg-gray-800/90 p-6 border-2 border-gray-600 mb-8">
                     <h3 className="text-green-400 uppercase text-sm mb-2 border-b border-gray-600 pb-1">Mission Briefing</h3>
                     <p className="text-white leading-relaxed font-mono text-sm">{characters.missionBriefing}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="text-white uppercase bg-blue-900/50 p-2 mb-4 border-l-4 border-blue-500">Heroes</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            {characters.heroes.map(c => <CharacterCard key={c.id} character={c} onClick={() => handleEditCharacter(c)} savedImages={cachedImages} />)}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-white uppercase bg-red-900/50 p-2 mb-4 border-l-4 border-red-500">Threats</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            {characters.villains.map(c => <CharacterCard key={c.id} character={c} onClick={() => handleEditCharacter(c)} savedImages={cachedImages} />)}
                        </div>
                    </div>
                </div>
                
                <div className="mt-12 text-center">
                    <button onClick={() => setView('generate')} className="text-gray-500 hover:text-white underline text-sm">Dismiss Squad & Restart</button>
                </div>
            </div>
        </div>
      );
  }

  // --- Main Render Switch ---

  return (
    <>
        {view === 'generate' && renderGenerate()}
        {view === 'recruiting' && renderRecruiting()}
        {view === 'briefing' && renderBriefing()}
        {view === 'review' && renderReview()}
        {view === 'edit_character' && editingCharacter && (
            <div className="min-h-screen flex items-center justify-center p-4">
                <CharacterProfileScreen character={editingCharacter} onSave={handleSaveCharacter} onBack={() => setView('review')} savedImages={cachedImages} />
            </div>
        )}
        
        {view === 'war_room' && (
             <div className="min-h-screen p-4 md:p-8 flex flex-col items-center bg-gray-900 text-white">
                <div className="w-full max-w-6xl">
                    <div className="flex justify-between items-end mb-6 border-b-4 border-gray-700 pb-2">
                        <div>
                            <h2 className="text-4xl text-yellow-400 font-bold uppercase tracking-tighter">War Room</h2>
                            <p className="text-sm text-gray-400">Tactical Archives & Records</p>
                        </div>
                        <Button onClick={() => setView('generate')} className="!py-2 !text-xs !bg-gray-600">Back to Base</Button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mb-6">
                        <button 
                            onClick={() => setWarRoomTab('squads')}
                            className={`px-6 py-2 uppercase font-bold text-sm tracking-wider ${warRoomTab === 'squads' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            Squad Archives
                        </button>
                        <button 
                            onClick={() => setWarRoomTab('barracks')}
                            className={`px-6 py-2 uppercase font-bold text-sm tracking-wider ${warRoomTab === 'barracks' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            Barracks
                        </button>
                        <button 
                            onClick={() => setWarRoomTab('leaderboard')}
                            className={`px-6 py-2 uppercase font-bold text-sm tracking-wider ${warRoomTab === 'leaderboard' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            Hall of Fame
                        </button>
                    </div>

                    {/* Content */}
                    <div className="bg-gray-800/50 p-6 border-2 border-gray-600 min-h-[400px]">
                        {warRoomTab === 'squads' && (
                            <div className="space-y-6">
                                {savedCasts.length > 0 ? (
                                    savedCasts.map(cast => (
                                        <div key={cast.createdAt} className="bg-gray-900 p-4 border-2 border-gray-700 hover:border-yellow-500 transition-colors">
                                             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-gray-800 pb-2">
                                                <div className="mb-2 md:mb-0">
                                                    <h3 className="text-xl text-yellow-400 font-bold uppercase">{cast.name}</h3>
                                                    <p className="text-xs text-gray-400 font-mono">
                                                        {new Date(cast.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button onClick={() => handleLoadCast(cast)} className="!py-1 !px-3 !text-xs !bg-green-700">Load Deployment</Button>
                                                    <Button onClick={() => handleDeleteCast(cast.name)} className="!py-1 !px-3 !text-xs !bg-red-900/50 border border-red-900 hover:!bg-red-900">Delete</Button>
                                                </div>
                                             </div>
                                             
                                             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                                 {cast.characters.heroes.map(char => (
                                                     <div key={char.id} className="relative group">
                                                         <div className="h-24 bg-black border border-gray-600 p-1 flex flex-col items-center">
                                                            {char.imageUrl ? (
                                                                <img src={char.imageUrl} alt={char.name} className="h-16 object-contain pixel-art" style={{imageRendering: 'pixelated'}} />
                                                            ) : (
                                                                <div className="h-16 w-full bg-gray-800 flex items-center justify-center text-xs text-gray-500">No Img</div>
                                                            )}
                                                            <span className="text-[10px] text-gray-300 truncate w-full text-center mt-1">{char.name}</span>
                                                         </div>
                                                         <button 
                                                            onClick={() => handleEditSavedCharacter(char, cast.name)}
                                                            className="absolute inset-0 bg-black/80 hidden group-hover:flex items-center justify-center text-yellow-400 text-xs font-bold uppercase border-2 border-yellow-500"
                                                         >
                                                             Edit
                                                         </button>
                                                     </div>
                                                 ))}
                                             </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-20 text-gray-500">
                                        <p className="text-lg">No saved squads found.</p>
                                        <p className="text-sm">Complete a recruitment to save a squad.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {warRoomTab === 'barracks' && (
                             <div>
                                 <div className="flex justify-between items-center mb-4">
                                     <p className="text-sm text-gray-400">Select heroes to form a new squad.</p>
                                     <div className="flex items-center gap-4">
                                         <span className="text-yellow-400 font-bold uppercase text-sm">Drafted: {selectedDraftHeroes.length} / 4</span>
                                         <Button 
                                            onClick={handleDeployDraft} 
                                            disabled={selectedDraftHeroes.length === 0}
                                            className="!py-2 !px-4 !text-sm !bg-green-700 disabled:!bg-gray-600"
                                         >
                                            Assemble Squad
                                         </Button>
                                     </div>
                                 </div>
                                 
                                 {heroPool.length > 0 ? (
                                     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                         {heroPool.map(hero => {
                                             const isSelected = selectedDraftHeroes.some(h => h.id === hero.id);
                                             return (
                                                 <div 
                                                    key={hero.id} 
                                                    onClick={() => toggleDraftHero(hero)}
                                                    className={`relative bg-gray-900 border-2 cursor-pointer transition-all hover:scale-105 group ${isSelected ? 'border-yellow-400 ring-2 ring-yellow-400/50' : 'border-gray-700 hover:border-gray-500'}`}
                                                 >
                                                     <div className="h-32 bg-black/50 flex flex-col items-center justify-center p-2 relative">
                                                          {hero.imageUrl ? (
                                                              <img src={hero.imageUrl} className="h-full object-contain pixel-art" style={{imageRendering: 'pixelated'}} />
                                                          ) : (
                                                              <div className="text-gray-600 text-2xl">?</div>
                                                          )}
                                                          {isSelected && (
                                                              <div className="absolute top-2 right-2 w-6 h-6 bg-yellow-400 text-black font-bold rounded-full flex items-center justify-center text-sm">✓</div>
                                                          )}
                                                          {/* Delete button (only visible on hover and if not selected) */}
                                                          {!isSelected && (
                                                            <button 
                                                                onClick={(e) => handleDeleteHeroFromPool(hero.id, e)}
                                                                className="absolute top-1 right-1 w-5 h-5 bg-red-900/80 text-white rounded hover:bg-red-600 hidden group-hover:flex items-center justify-center text-xs"
                                                                title="Delete permanently"
                                                            >
                                                                X
                                                            </button>
                                                          )}
                                                     </div>
                                                     <div className="p-2 text-center bg-gray-800">
                                                         <p className="text-xs font-bold text-white truncate">{hero.name}</p>
                                                         <p className="text-[10px] text-gray-400 truncate">{hero.weaponType}</p>
                                                     </div>
                                                 </div>
                                             );
                                         })}
                                     </div>
                                 ) : (
                                     <div className="text-center py-20 text-gray-500">
                                         <p className="text-lg">Barracks are empty.</p>
                                         <p className="text-sm">Recruit new heroes to populate the waiting room.</p>
                                     </div>
                                 )}
                             </div>
                        )}

                        {warRoomTab === 'leaderboard' && (
                             <div className="overflow-x-auto">
                                 {highScores.length > 0 ? (
                                     <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b-2 border-gray-600 text-gray-400 uppercase text-xs">
                                                <th className="p-3">Rank</th>
                                                <th className="p-3">Score</th>
                                                <th className="p-3">Diff</th>
                                                <th className="p-3">Hero</th>
                                                <th className="p-3">Squad</th>
                                                <th className="p-3 text-right">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="font-mono text-sm">
                                            {highScores.map((score, index) => (
                                                <tr key={score.id} className="border-b border-gray-700 hover:bg-white/5">
                                                    <td className="p-3 text-yellow-500 font-bold">#{index + 1}</td>
                                                    <td className="p-3 text-white">{score.score.toLocaleString()}</td>
                                                    <td className="p-3">
                                                        <span className={`text-[10px] px-1 py-0.5 rounded ${score.difficulty === 'HARD' ? 'bg-red-900 text-red-200' : score.difficulty === 'EASY' ? 'bg-green-900 text-green-200' : 'bg-blue-900 text-blue-200'}`}>
                                                            {score.difficulty || 'NORMAL'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-cyan-400">{score.heroName}</td>
                                                    <td className="p-3 text-gray-300">{score.castName}</td>
                                                    <td className="p-3 text-right text-gray-500">{new Date(score.date).toLocaleDateString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                     </table>
                                 ) : (
                                     <div className="text-center py-20 text-gray-500">
                                         <p className="text-lg">No mission records found.</p>
                                         <p className="text-sm">Deploy a squad and score points to appear here.</p>
                                     </div>
                                 )}
                             </div>
                        )}
                    </div>
                </div>
             </div>
        )}

        {isSaveModalOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-gray-800 p-6 border-4 border-yellow-500 max-w-sm w-full shadow-2xl">
                    <h2 className="text-xl text-yellow-400 mb-4 uppercase">Operation Codename</h2>
                    <Input
                        key={theme} // Force re-render if theme changes
                        type="text"
                        defaultValue={theme}
                        placeholder="e.g. Alpha Squad"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNewCast( (e.target as HTMLInputElement).value ) }}
                        ref={saveInputRef}
                    />
                    <div className="flex justify-end gap-2 mt-6">
                        <Button onClick={() => setIsSaveModalOpen(false)} className="!bg-gray-600 !py-2 !text-xs">Cancel</Button>
                        <Button onClick={() => handleSaveNewCast(saveInputRef.current?.value || theme)} className="!py-2 !text-xs">Confirm</Button>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default MenuScreen;
