import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
import { MainLayout } from './components/layout/MainLayout';
import { AppErrorBoundary } from './components/errors/AppErrorBoundary';
import { AppRoutes } from './AppRoutes';

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <GameProvider>
          <MainLayout>
            <AppRoutes />
          </MainLayout>
        </GameProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
