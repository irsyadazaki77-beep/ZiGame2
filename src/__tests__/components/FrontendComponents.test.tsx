// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, Badge, Card, Input, Modal } from '../../components/UI';
import { ShopBanner } from '../../components/shop/ShopBanner';
import DailyMissionsPanel from '../../components/DailyMissionsPanel';
import GlobalLeaderboard from '../../components/GlobalLeaderboard';
import { AudioSettingsSection } from '../../components/settings/AudioSettingsSection';
import { SecuritySettingsSection } from '../../components/settings/SecuritySettingsSection';
import { DataBackupSection } from '../../components/settings/DataBackupSection';
import { ProfileHeader } from '../../components/profile/ProfileHeader';
import { createTestUser } from '../helpers/factories';

describe('Frontend React UI Components — Behavior, States & Accessibility', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Core UI Primitives (Button, Modal, Input, Badge, Card)', () => {
    it('renders Modal when open and fires onClose on overlay or close button click', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Cyber Modal">
          <p>Modal Body Text</p>
        </Modal>
      );

      expect(screen.getByText('Cyber Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal Body Text')).toBeInTheDocument();

      const closeButton = screen.getByRole('button', { name: /Tutup Dialog/i });
      fireEvent.click(closeButton);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('renders disabled Button and prevents onClick dispatch', () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} disabled>
          Processing Transaction...
        </Button>
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Shop & Economy UI Components', () => {
    it('renders ShopBanner with user coin balance and tabs', () => {
      const profile = createTestUser({ coins: 250 });
      render(
        <ShopBanner
          profile={profile}
          tab="all"
          setTab={vi.fn()}
          onOpenGuide={vi.fn()}
        />
      );

      expect(screen.getByText(/250/i)).toBeInTheDocument();
      expect(screen.getByText(/TOKO KOSMETIK/i)).toBeInTheDocument();
    });
  });

  describe('Missions & Challenges Components', () => {
    it('renders DailyMissionsPanel with mission progress', () => {
      const missions = [
        {
          id: 'm1',
          description: 'Mainkan 3 Game',
          rewardCoins: 50,
          rewardXp: 30,
          progress: 3,
          target: 3,
          completed: true,
          claimed: false
        }
      ];

      render(<DailyMissionsPanel missions={missions as any} themeColor="indigo" />);

      expect(screen.getByText(/Mainkan 3 Game/i)).toBeInTheDocument();
      expect(screen.getByText(/Misi Harian/i)).toBeInTheDocument();
    });

    it('renders empty state when no daily missions are active', () => {
      render(<DailyMissionsPanel missions={[]} themeColor="indigo" />);
      expect(screen.getByText(/Misi Harian/i)).toBeInTheDocument();
    });
  });

  describe('Profile Components', () => {
    it('renders ProfileHeader with level, XP, and active tab', () => {
      const user = createTestUser({ name: 'CyberPilot', level: 5, xp: 1250, coins: 500 });
      const rank = { title: 'Vanguard', desc: 'Elite Commander', color: 'text-indigo-400', bg: 'bg-indigo-500/10' };

      render(
        <ProfileHeader
          profile={user}
          loggedInUser={user.name}
          activeTab="overview"
          setActiveTab={vi.fn()}
          playerRank={rank}
        />
      );

      expect(screen.getByText('CyberPilot')).toBeInTheDocument();
      expect(screen.getByText(/LEVEL 5/i)).toBeInTheDocument();
    });
  });

  describe('Settings & Security Components', () => {
    it('renders AudioSettingsSection with toggle mute control', () => {
      render(
        <AudioSettingsSection
          isMuted={false}
          onToggleMute={vi.fn()}
          onTestSound={vi.fn()}
        />
      );

      expect(screen.getByText(/SINTESIS AUDIO & SUARA/i)).toBeInTheDocument();
      expect(screen.getByText(/Bungkam Semua Suara/i)).toBeInTheDocument();
    });

    it('renders SecuritySettingsSection with autolock options', () => {
      render(
        <SecuritySettingsSection
          autolockVal="15"
          setAutolockVal={vi.fn()}
          setSuccessMsg={vi.fn()}
        />
      );

      expect(screen.getByText(/KEAMANAN & AUTOLOCK SESI/i)).toBeInTheDocument();
      expect(screen.getByText(/Kunci Otomatis Sesi Tamu\/Akun/i)).toBeInTheDocument();
    });

    it('renders DataBackupSection with export/import controls', () => {
      const profile = createTestUser();
      render(
        <DataBackupSection
          profile={profile}
          loggedInUser={profile.name}
          onUpdateProfile={vi.fn()}
          setSuccessMsg={vi.fn()}
        />
      );

      expect(screen.getByText(/CADANGAN & PEMULIHAN DATA/i)).toBeInTheDocument();
      expect(screen.getByText(/EKSPOR CADANGAN/i)).toBeInTheDocument();
      expect(screen.getByText(/IMPOR CADANGAN/i)).toBeInTheDocument();
    });
  });
});
