import React from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Inspiration from './pages/Inspiration';
import Create from './pages/Create';
import Profile from './pages/Profile';
import Editor from './pages/Editor';
import ExportPreview from './pages/ExportPreview';
import BottomNav from './components/BottomNav';
import { ColorProvider } from './context/ColorContext';

const AppContent: React.FC = () => {
  const location = useLocation();
  const showBottomNav = ['/', '/create', '/profile'].includes(location.pathname);

  return (
    <>
      <Routes>
        <Route path="/" element={<Inspiration />} />
        <Route path="/create" element={<Create />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/editor/:id" element={<Editor />} />
        <Route path="/preview/:id" element={<ExportPreview />} />
      </Routes>
      {showBottomNav && <BottomNav />}
    </>
  );
};

const App: React.FC = () => {
  return (
    <ColorProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </ColorProvider>
  );
};

export default App;
