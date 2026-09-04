import React from 'react';
import { GameProvider } from './contexts/GameContext';
import { MainLayout } from './components/layout/MainLayout';
import { AppErrorBoundary } from './components/errors/AppErrorBoundary';
import { AppRoutes } from './AppRoutes';

export default function App() {
  return (
    <AppErrorBoundary>
      <GameProvider>
        <MainLayout>
          <AppRoutes />
        </MainLayout>
      </GameProvider>
    </AppErrorBoundary>
  );
}
