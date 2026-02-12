
import React, { useState, useRef } from 'react';
import type { CharacterProfile } from '../types';
import { generateCharacterImage, generateCharacterVideo } from '../services/geminiService';
import { audioService } from '../services/audioService';
import Button from './ui/Button';
import RotatingLoader from './ui/RotatingLoader';
import Input from './ui/Input';
import { IoVolumeHighOutline, IoVideocamOutline, IoImageOutline } from 'react-icons/io5';

interface InteractiveCharacterViewerProps {
    imageUrl: string | null;
    videoUrl: string | null;
    altText: string;
    isGenerating: boolean;
    savedImages: string[];
}

const InteractiveCharacterViewer: React.FC<InteractiveCharacterViewerProps> = ({ imageUrl, videoUrl, altText, isGenerating, savedImages }) => {
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

    const hasContent = !!imageUrl || !!videoUrl;

    return (
        <div 
            className="w-64 h-64 mx-auto mb-4"
            style={{ perspective: '1000px' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <div className="relative w-full h-full transform-style-3d" style={style}>
                <div className="absolute inset-0 bg-gray-900 border-4 border-gray-600 flex items-center justify-center overflow-hidden">
                    {isGenerating ? (
                        <RotatingLoader images={savedImages} size="lg" />
                    ) : !hasContent ? (
                        <span className="text-gray-500 text-6xl">?</span>
                    ) : videoUrl ? (
                         <video 
                             src={videoUrl} 
                             className="w-full h-full object-cover" 
                             autoPlay 
                             loop 
                             muted 
                             playsInline 
                             controls={false}
                         />
                    ) : (
                        <img src={imageUrl!} alt={altText} className="w-full h-full object-contain" />
                    )}
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
  const [videoPrompt, setVideoPrompt] = useState(`Cinematic action shot of ${character.name}, ${character.description}, 8-bit style.`);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateImage = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const imageUrl = await generateCharacterImage(internalCharacter);
      const updatedCharacter = { ...internalCharacter, imageUrl, videoUrl: undefined }; // Clear video if new image gen
      setInternalCharacter(updatedCharacter);
      setHasUnsavedChanges(true);
    } catch (e) {
      console.error(e);
      setError('Failed to generate image. The content may have been blocked or an API error occurred. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!internalCharacter.imageUrl) {
        setError("An image is required to animate.");
        return;
    }
    setIsGenerating(true);
    setError(null);
    try {
        const videoUrl = await generateCharacterVideo(internalCharacter.imageUrl, videoPrompt);
        const updatedCharacter = { ...internalCharacter, videoUrl };
        setInternalCharacter(updatedCharacter);
        setHasUnsavedChanges(true);
    } catch (e: any) {
        console.error(e);
        setError(`Failed to animate: ${e.message}`);
    } finally {
        setIsGenerating(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInternalCharacter(prev => ({ ...prev!, [name]: value }));
    setHasUnsavedChanges(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64String = reader.result as string;
              setInternalCharacter(prev => ({...prev, imageUrl: base64String, videoUrl: undefined }));
              setHasUnsavedChanges(true);
          };
          reader.readAsDataURL(file);
      }
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
            videoUrl={internalCharacter.videoUrl || null}
            altText={internalCharacter.name}
            isGenerating={isGenerating}
            savedImages={savedImages}
        />

        {/* Media Controls */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
             <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                className="hidden" 
                accept="image/*"
             />
             <Button onClick={() => fileInputRef.current?.click()} className="!py-2 !px-3 !text-xs !bg-blue-600 flex items-center gap-1" disabled={isGenerating}>
                 <IoImageOutline /> Upload Photo
             </Button>
             <Button onClick={handleGenerateImage} className="!py-2 !px-3 !text-xs !bg-purple-600 flex items-center gap-1" disabled={isGenerating}>
                Gen Portrait
             </Button>
             <Button onClick={handleGenerateVideo} className="!py-2 !px-3 !text-xs !bg-green-600 flex items-center gap-1" disabled={isGenerating || !internalCharacter.imageUrl}>
                <IoVideocamOutline /> Animate (Veo)
             </Button>
        </div>
        
        {/* Video Prompt Input (Only visible if animating is possible) */}
        {internalCharacter.imageUrl && (
            <div className="mb-4 text-left">
                <label className="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-wider">Animation Prompt</label>
                <Input 
                    value={videoPrompt} 
                    onChange={(e) => setVideoPrompt(e.target.value)} 
                    className="!py-1 !px-2 !text-xs !border-gray-700 focus:!border-green-500"
                    placeholder="Describe how the character should move..."
                />
            </div>
        )}

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
        
        {error && <p className="text-red-500 my-4 text-sm bg-red-900/20 p-2 border border-red-500">{error}</p>}
        
        <div className="flex justify-center gap-4 mt-6 border-t border-gray-700 pt-6">
            <Button onClick={onBack} className="!bg-gray-600">Back</Button>
            <Button onClick={handleSave} disabled={isGenerating || !hasUnsavedChanges}>
                Save Changes
            </Button>
        </div>
      </div>
    </div>
  );
};

export default CharacterProfileScreen;
