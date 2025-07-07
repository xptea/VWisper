import React, { useEffect } from 'react';
import iconPath from '../assets/icon.png';

interface SplashscreenProps {
  onComplete: () => void;
}

const Splashscreen: React.FC<SplashscreenProps> = ({ onComplete }) => {
  useEffect(() => {
    console.log("Splashscreen mounted, starting 2 second timer");
    const timer = setTimeout(() => {
      console.log("Splashscreen timer completed, calling onComplete");
      onComplete();
    }, 2000); // Show splash for 2 seconds

    return () => {
      console.log("Splashscreen unmounting, clearing timer");
      clearTimeout(timer);
    };
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center">
      <div className="flex flex-col items-center space-y-4 p-8">
        <img 
          src={iconPath} 
          alt="VWisper Logo" 
          className="w-20 h-20 object-contain"
        />
        <h1 className="text-2xl font-bold text-white">VWisper</h1>
        <div className="w-8 h-1 bg-white rounded-full opacity-50 animate-pulse"></div>
      </div>
    </div>
  );
};

export default Splashscreen;
