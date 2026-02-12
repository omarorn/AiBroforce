
import React from 'react';
import type { CharacterProfile } from '../../types';
import { audioService } from '../../services/audioService';
import RotatingLoader from './RotatingLoader';
import DecodingText from './DecodingText';
import { IoVolumeHighOutline } from 'react-icons/io5';

interface CharacterCardProps {
  character: CharacterProfile;
  onClick?: () => void;
  small?: boolean;
  savedImages: string[];
}

const CharacterCard: React.FC<CharacterCardProps> = ({ character, onClick, small=false, savedImages }) => {

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    if(character.catchphrase) audioService.speak(character.catchphrase);
  };

  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 border-2 border-gray-600 p-2 transition-all duration-200 flex flex-col relative group ${onClick ? 'cursor-pointer hover:border-yellow-400 hover:scale-105' : ''} ${small ? 'w-32 h-48' : 'h-full min-h-[250px]'}`}
    >
      <div className="absolute inset-0 bg-black/10 pointer-events-none group-hover:bg-transparent"></div>
      
      {/* Image Area */}
      <div className="w-full h-1/2 mb-2 bg-gray-900 relative">
        {character.imageUrl ? (
            <img src={character.imageUrl} alt={character.name} className="w-full h-full object-contain pixel-art" style={{imageRendering: 'pixelated'}} />
        ) : (
            <div className="absolute inset-0">
                 <RotatingLoader images={savedImages} size="sm" className="w-full h-full opacity-50" />
                 <div className="absolute inset-0 flex items-center justify-center text-[10px] text-yellow-400 font-bold bg-black/50">
                    DECODING...
                 </div>
            </div>
        )}
      </div>
      
      <div className="flex-grow flex flex-col overflow-hidden">
        <DecodingText 
            text={character.name} 
            as="h3" 
            className={`${small ? 'text-xs' : 'text-sm'} font-bold uppercase text-yellow-400 truncate leading-tight`} 
            revealSpeed={50}
        />
        
        {!small && (
             <>
                <div className="text-[10px] bg-red-900/50 text-gray-200 px-1 rounded mt-1 truncate inline-block self-start">
                    <DecodingText text={character.weaponType || "???"} revealSpeed={30} startDelay={200} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 line-clamp-2 leading-tight">
                    {character.description || "Classified data..."}
                </p>
                <div className="mt-auto pt-2 flex justify-between items-center">
                    <span className="text-[10px] text-cyan-400 truncate">"{character.catchphrase || '...'}"</span>
                    <button onClick={handleSpeak} className="p-1 hover:text-white"><IoVolumeHighOutline /></button>
                </div>
             </>
        )}
      </div>
    </div>
  )
};

export default CharacterCard;
