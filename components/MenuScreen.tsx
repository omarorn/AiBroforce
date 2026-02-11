
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { GeneratedCharacters, CharacterProfile, SavedCast } from '../types';
import { generateCharacters, generateCharacterImage, generateMissionBriefing } from '../services/geminiService';
import { audioService } from '../services/audioService';
import { storageService } from '../services/storageService';
import Button from './ui/Button';
import Input from './ui/Input';
import RotatingLoader from './ui/RotatingLoader';
import CharacterProfileScreen from './CharacterProfileScreen';
import { IoVolumeHighOutline } from 'react-icons/io5';

interface MenuScreenProps {
  onStartGame: (characters: GeneratedCharacters, startingHero: CharacterProfile) => void;
}

type View = 'generate' | 'recruiting' | 'review' | 'edit_character' | 'casting_couch' | 'briefing';

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

const CharacterCard: React.FC<{
  character: CharacterProfile;
  onClick?: () => void;
  small?: boolean;
  savedImages: string[];
}> = ({ character, onClick, small=false, savedImages }) => {

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    audioService.speak(character.catchphrase);
  };

  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 border-2 border-gray-600 p-2 transition-all duration-200 flex flex-col relative group ${onClick ? 'cursor-pointer hover:border-yellow-400 hover:scale-105' : ''} ${small ? 'w-32 h-48' : 'h-full min-h-[250px]'}`}
    >
      <div className="absolute inset-0 bg-black/10 pointer-events-none group-hover:bg-transparent"></div>
      
      {character.imageUrl ? (
        <img src={character.imageUrl} alt={character.name} className="w-full h-1/2 object-contain mb-2 bg-gray-900 pixel-art" style={{imageRendering: 'pixelated'}} />
      ) : (
        <div className="w-full h-1/2 mb-2">
            <RotatingLoader images={savedImages} size="sm" className="w-full h-full" />
        </div>
      )}
      
      <div className="flex-grow flex flex-col overflow-hidden">
        <h3 className={`${small ? 'text-xs' : 'text-sm'} font-bold uppercase text-yellow-400 truncate leading-tight`}>{character.name}</h3>
        {!small && (
             <>
                <span className="text-[10px] bg-red-900/50 text-gray-200 px-1 rounded mt-1 truncate">
                    {character.weaponType}
                </span>
                <p className="text-[10px] text-gray-400 mt-1 line-clamp-2 leading-tight">{character.description}</p>
                <div className="mt-auto pt-2 flex justify-between items-center">
                    <span className="text-[10px] text-cyan-400 truncate">"{character.catchphrase}"</span>
                    <button onClick={handleSpeak} className="p-1 hover:text-white"><IoVolumeHighOutline /></button>
                </div>
             </>
        )}
      </div>
    </div>
  )
};

const ConsoleLog: React.FC<{logs: string[]}> = ({logs}) => {
    const endRef = useRef<HTMLDivElement>(null);
    useEffect(() => endRef.current?.scrollIntoView({behavior:'smooth'}), [logs]);

    return (
        <div className="bg-black/90 text-green-500 font-mono text-xs p-4 h-full overflow-y-auto border-2 border-green-800 shadow-[inset_0_0_20px_rgba(0,50,0,0.5)]">
            {logs.map((log, i) => <div key={i} className="mb-1">{`> ${log}`}</div>)}
            <div ref={endRef} />
        </div>
    )
}

const MenuScreen: React.FC<MenuScreenProps> = ({ onStartGame }) => {
  const [view, setView] = useState<View>('generate');
  
  // State for Generation Process
  const [theme, setTheme] = useState<string>(getRandomTheme());
  const [characterCount, setCharacterCount] = useState<number>(4);
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
  const [currentCastName, setCurrentCastName] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const saveInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSavedCasts(storageService.loadCasts());
    setCachedImages(storageService.getAllCharacterImages());
  }, []);

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
        
        // 2. Initialize placeholders
        setRecruitedHeroes(data.heroes); 
        setRecruitedVillains(data.villains);
        
        const allChars = [...data.heroes, ...data.villains];
        const fullyRecruited: CharacterProfile[] = [];

        // 3. Sequential Image Generation (The Lineup)
        for (const char of allChars) {
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

            } catch (err) {
                addLog(`ERROR GENERATING IMAGE FOR ${char.name}: ${err}`);
                fullyRecruited.push(char); // Keep character even if image fails
            }
        }

        addLog(`RECRUITMENT COMPLETE.`);
        
        // 4. Mission Briefing Sequence (Skydiving)
        setView('briefing');
        audioService.playSound('dash'); // Whoosh sound for transition

        // Filter arrays locally to ensure we pass complete data to briefing gen
        const finalHeroes = fullyRecruited.filter(c => data.heroes.some(h => h.id === c.id));
        const finalVillains = fullyRecruited.filter(c => data.villains.some(v => v.id === c.id));
        
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
    onStartGame(characters, startingHero);
  };

  const handleEditCharacter = (char: CharacterProfile) => {
    setEditingCharacter(char);
    setView('edit_character');
  };

  const handleSaveCharacter = (updatedChar: CharacterProfile) => {
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
        storageService.saveCast(currentCastName, newCharacters);
    }
    setView('review');
    setEditingCharacter(null);
  };
  
  const handleSaveNewCast = (name: string) => {
      if(characters && name.trim()) {
          storageService.saveCast(name.trim(), characters);
          setCurrentCastName(name.trim());
          setSavedCasts(storageService.loadCasts());
          setIsSaveModalOpen(false);
      }
  };

  const handleLoadCast = (cast: SavedCast) => {
      setCharacters(cast.characters);
      setCurrentCastName(cast.name);
      setView('review');
  };
  
  const handleDeleteCast = (name: string) => {
      if(window.confirm(`Are you sure you want to delete the cast "${name}"?`)){
        storageService.deleteCast(name);
        setSavedCasts(storageService.loadCasts());
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

                <div className="flex items-center justify-between bg-black/30 p-4 rounded">
                    <label className="text-white uppercase text-sm">Squad Size</label>
                    <div className="flex items-center gap-4">
                        <input 
                            type="range" 
                            min="1" 
                            max="8" 
                            value={characterCount} 
                            onChange={(e) => setCharacterCount(parseInt(e.target.value))} 
                            className="w-48 accent-yellow-400"
                        />
                        <span className="text-2xl text-yellow-400 font-bold w-8">{characterCount}</span>
                    </div>
                </div>

                <Button onClick={startRecruitment} className="!text-2xl !py-6 !bg-green-600 hover:!bg-green-500 hover:scale-[1.02] shadow-[0_4px_0_#14532d] active:shadow-none active:translate-y-1">
                    INITIATE RECRUITMENT
                </Button>
            </div>
             {savedCasts.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-600">
                    <Button onClick={() => setView('casting_couch')} className="!bg-purple-700 !text-sm w-full">Load Previous Operation</Button>
                </div>
            )}
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
                        <p className="text-xs text-gray-400 mt-1">Ready for deployment</p>
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
        {view === 'casting_couch' && (
             <div className="min-h-screen p-8 flex flex-col items-center">
                <h2 className="text-3xl text-yellow-400 mb-8 uppercase">Saved Operations</h2>
                <div className="w-full max-w-4xl space-y-4">
                    {savedCasts.map(cast => (
                        <div key={cast.createdAt} className="bg-gray-800 p-4 border-2 border-gray-600 flex justify-between items-center hover:bg-gray-700">
                             <div>
                                <h3 className="text-xl text-white font-bold">{cast.name}</h3>
                                <p className="text-xs text-gray-400">{new Date(cast.createdAt).toLocaleDateString()} • {cast.characters.heroes.length} Heroes</p>
                             </div>
                             <div className="flex gap-2">
                                <Button onClick={() => handleLoadCast(cast)} className="!py-1 !text-sm">Load</Button>
                                <Button onClick={() => handleDeleteCast(cast.name)} className="!py-1 !text-sm !bg-red-900">Delete</Button>
                             </div>
                        </div>
                    ))}
                    {savedCasts.length === 0 && <p className="text-gray-500">No saved data found.</p>}
                </div>
                <Button onClick={() => setView('generate')} className="mt-8">Back</Button>
             </div>
        )}

        {isSaveModalOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-gray-800 p-6 border-4 border-yellow-500 max-w-sm w-full shadow-2xl">
                    <h2 className="text-xl text-yellow-400 mb-4 uppercase">Operation Codename</h2>
                    <Input
                        type="text"
                        placeholder="e.g. Alpha Squad"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNewCast( (e.target as HTMLInputElement).value ) }}
                        ref={saveInputRef}
                    />
                    <div className="flex justify-end gap-2 mt-6">
                        <Button onClick={() => setIsSaveModalOpen(false)} className="!bg-gray-600 !py-2 !text-xs">Cancel</Button>
                        <Button onClick={() => handleSaveNewCast(saveInputRef.current?.value || '')} className="!py-2 !text-xs">Confirm</Button>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default MenuScreen;
