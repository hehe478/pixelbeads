import React, { useEffect, useState } from 'react';
import MobileEditor from './MobileEditor';
import DesktopEditor from './DesktopEditor';

const Editor: React.FC = () => {
  // Changed from 1024 to 768 to allow iPads/Tablets to use the Desktop layout
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isDesktop ? <DesktopEditor /> : <MobileEditor />;
};

export default Editor;