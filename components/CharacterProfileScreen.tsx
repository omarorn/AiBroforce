
import React, { useState } from 'react';
import type { CharacterProfile } from '../types';
import { generateCharacterImage } from '../services/geminiService';
import { audioService } from '../services/audioService';
import Button from './ui/Button';
import RotatingLoader from './ui/RotatingLoader';
import Input from './ui/Input';
import { IoVolumeHighOutline } from 'react-icons/io5';

interface InteractiveCharacterViewerProps {
    imageUrl: string | null;
    altText: string;
    isGenerating: boolean;
    savedImages: string[];
}

const InteractiveCharacterViewer: React.FC<InteractiveCharacterViewerProps> = ({ imageUrl, altText, isGenerating, savedImages }) => {
    const [style, setStyle] = useState<React.CSSProperties>({});
    const [sheenStyle, setSheenStyle] = useState<React.CSSProperties>({});

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - left;
        const y = e.clientY - top;
        const rotateX = -1 * ((y / height) * 20 - 10);
        const rotateY = (x / width) * 20 - 10;
        
        const sheenX = (x / width) * 100;
        const sheenY = (y / height) * 100;

        setStyle({
            transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`,
            transition: 'transform 0.1s ease-out'
        });

        setSheenStyle({
            background: `radial-gradient(circle at ${sheenX}% ${sheenY}%, rgba(255, 255, 255, 0.2), transparent 40%)`,
        });
    };

    const handleMouseLeave = () => {
        setStyle({
            transform: 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)',
            transition: 'transform 0.5s ease-in-out'
        });
        setSheenStyle({ background: 'transparent' });
    };

    const hasImage = !!imageUrl;

    return (
        <div 
            className="w-64 h-64 mx-auto mb-4"
            style={{ perspective: '1000px' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <div className="relative w-full h-full transform-style-3d" style={style}>
                <div className="absolute inset-0 bg-gray-900 border-4 border-gray-600 flex items-center justify-center">
                    {isGenerating ? (
                        <RotatingLoader images={savedImages} size="lg" />
                    ) : !hasImage ? (
                        <span className="text-gray-500 text-6xl">?</span>
                    ) : null}
                    {!isGenerating && hasImage && <img src={imageUrl!} alt={altText} className="w-full h-full object-contain" />}
                </div>
                <div className="absolute inset-0" style={sheenStyle}></div>
            </div>
        </div>
    );
};


interface CharacterProfileScreenProps {
  character: CharacterProfile;
  onSave: (updatedCharacter: CharacterProfile) => void;
  onBack: () => void;
  savedImages?: string[];
}

const CharacterProfileScreen: React.FC<CharacterProfileScreenProps> = ({ character, onSave, onBack, savedImages = [] }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalCharacter, setInternalCharacter] = useState<CharacterProfile>(character);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleGenerateImage = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const imageUrl = await generateCharacterImage(internalCharacter);
      const updatedCharacter = { ...internalCharacter, imageUrl };
      setInternalCharacter(updatedCharacter);
      setHasUnsavedChanges(true);
    } catch (e) {
      console.error(e);
      setError('Failed to generate image. The content may have been blocked or an API error occurred. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInternalCharacter(prev => ({ ...prev!, [name]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    onSave(internalCharacter);
    setHasUnsavedChanges(false);
    onBack(); // Go back after saving
  };

  const handleSpeak = () => {
    if (internalCharacter.catchphrase) {
        audioService.speak(internalCharacter.catchphrase);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div className="bg-gray-800/50 p-6 md:p-8 border-4 border-gray-700">
        
        <InteractiveCharacterViewer 
            imageUrl={internalCharacter.imageUrl || null}
            altText={internalCharacter.name}
            isGenerating={isGenerating}
            savedImages={savedImages}
        />

        <div className="bg-gray-900/50 p-4 space-y-4 text-left">
            <div>
                <label htmlFor="name" className="text-sm font-bold text-yellow-400 block mb-1 uppercase tracking-wider">Name</label>
                <Input id="name" name="name" type="text" value={internalCharacter.name} onChange={handleInputChange} />
            </div>
            
            <div>
                <label htmlFor="description" className="text-sm font-bold text-yellow-400 block mb-1 uppercase tracking-wider">Description</label>
                <textarea id="description" name="description" value={internalCharacter.description} onChange={handleInputChange} className="w-full bg-gray-800 border-2 border-gray-600 text-white px-4 py-3 focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:ring-opacity-50 focus:border-yellow-400 transition-all duration-200 ease-in-out" rows={3}></textarea>
            </div>

            <div>
                <label htmlFor="weaponType" className="text-sm font-bold text-yellow-400 block mb-1 uppercase tracking-wider">Weapon</label>
                <Input id="weaponType" name="weaponType" type="text" value={internalCharacter.weaponType} onChange={handleInputChange} />
            </div>

             <div>
                <label htmlFor="movementAbility" className="text-sm font-bold text-yellow-400 block mb-1 uppercase tracking-wider">Movement Quirk</label>
                <Input id="movementAbility" name="movementAbility" type="text" value={internalCharacter.movementAbility} onChange={handleInputChange} />
            </div>

            <div>
                <label htmlFor="specialAbility" className="text-sm font-bold text-yellow-400 block mb-1 uppercase tracking-wider">Special Ability</label>
                <Input id="specialAbility" name="specialAbility" type="text" value={internalCharacter.specialAbility} onChange={handleInputChange} />
            </div>

            <div>
                <label htmlFor="catchphrase" className="text-sm font-bold text-yellow-400 block mb-1 uppercase tracking-wider">Catchphrase</label>
                <div className="flex items-center gap-2">
                    <Input id="catchphrase" name="catchphrase" type="text" value={internalCharacter.catchphrase || ''} onChange={handleInputChange} className="flex-grow" />
                    <button
                        type="button"
                        onClick={handleSpeak}
                        className="p-3 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                        aria-label="Say catchphrase"
                    >
                        <IoVolumeHighOutline className="text-white h-5 w-5"/>
                    </button>
                </div>
            </div>
        </div>
        
        {error && <p className="text-red-500 my-4">{error}</p>}
        
        <div className="flex justify-center gap-4 mt-6">
            <Button onClick={onBack}>Back</Button>
            <Button onClick={handleGenerateImage} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : 'Generate Portrait'}
            </Button>
            <Button onClick={handleSave} disabled={isGenerating || !hasUnsavedChanges}>
                Save
            </Button>
        </div>
      </div>
    </div>
  );
};

export default CharacterProfileScreen;
