import { serverLogger } from '../logger';
import { ECONOMY_BALANCE_CONFIG } from '../../config/balanceConfig';
import {
  isFirestoreAvailable,
  getDb,
  memoryStore,
  assertPersistenceOperational,
  StoredEconomyTransaction,
  StoredEconomy
} from './db';
import { getUserEconomy } from './economy';
import crypto from 'crypto';

export interface EconomyReconciliationReport {
  userId: string;
  initialBalance: number;
  totalCredits: number;
  totalDebits: number;
  calculatedBalance: number;
  actualBalance: number;
  discrepancy: number;
  isReconciled: boolean;
  transactionCount: number;
  timestamp: string;
  fixed?: boolean;
}

export async function reconcileUserEconomy(userId: string, autoFix: boolean = false): Promise<EconomyReconciliationReport> {
  assertPersistenceOperational();
  const INITIAL_BALANCE = ECONOMY_BALANCE_CONFIG.starterCoins;
  let currentBalance = INITIAL_BALANCE;
  let userTransactions: StoredEconomyTransaction[] = [];

  if (isFirestoreAvailable()) {
    const db = getDb();
    const econDoc = await db.collection('userEconomy').doc(userId).get();
    if (econDoc.exists) {
      currentBalance = econDoc.data()?.coins ?? INITIAL_BALANCE;
    }
    const txSnap = await db.collection('economyTransactions')
      .where('userId', '==', userId)
      .get();
    userTransactions = txSnap.docs
      .map(d => d.data() as StoredEconomyTransaction)
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  } else {
    const econ = await getUserEconomy(userId);
    currentBalance = econ.coins;
    userTransactions = memoryStore.ledger.filter(tx => tx.userId === userId);
  }

  let totalCredits = 0;
  let totalDebits = 0;

  for (const tx of userTransactions) {
    if (tx.amount > 0) {
      totalCredits += tx.amount;
    } else {
      totalDebits += Math.abs(tx.amount);
    }
  }

  const calculatedBalance = INITIAL_BALANCE + totalCredits - totalDebits;
  let discrepancy = currentBalance - calculatedBalance;
  let isReconciled = discrepancy === 0;
  let fixed = false;

  if (!isReconciled) {
    serverLogger.security('ECONOMY_DISCREPANCY_FLAGGED', `User ${userId} economy mismatch: actual=${currentBalance}, calculated=${calculatedBalance}`, {
      userId,
      actualBalance: currentBalance,
      calculatedBalance,
      discrepancy,
      transactionCount: userTransactions.length
    });

    if (autoFix) {
      const correctionAmount = -discrepancy; // To add to actual to make it calculated
      const nowIso = new Date().toISOString();
      const transactionId = `tx_${Date.now()}_corr_${crypto.randomBytes(4).toString('hex')}`;

      if (isFirestoreAvailable()) {
        const db = getDb();
        const ecoRef = db.collection('userEconomy').doc(userId);
        const ledgerRef = db.collection('economyTransactions').doc(transactionId);

        await db.runTransaction(async (tx) => {
          const ecoDoc = await tx.get(ecoRef);
          const currentEco = ecoDoc.exists
            ? (ecoDoc.data() as StoredEconomy)
            : { userId, coins: INITIAL_BALANCE, totalEarned: INITIAL_BALANCE, totalSpent: 0, lastUpdated: Date.now() };

          const updatedEco: StoredEconomy = {
            ...currentEco,
            coins: calculatedBalance,
            lastUpdated: Date.now()
          };
          tx.set(ecoRef, updatedEco);

          tx.set(ledgerRef, {
            transactionId,
            userId,
            type: 'ADMIN_ADJUSTMENT',
            amount: correctionAmount,
            balanceBefore: currentBalance,
            balanceAfter: calculatedBalance,
            reason: `RECONCILIATION_CORRECTION_DISCREPANCY_${discrepancy}`,
            referenceId: 'reconcile_tool',
            createdAt: nowIso
          });
        });
      } else {
        const eco = await getUserEconomy(userId);
        eco.coins = calculatedBalance;
        eco.lastUpdated = Date.now();
        memoryStore.economies.set(userId, eco);

        memoryStore.ledger.push({
          transactionId,
          userId,
          type: 'ADMIN_ADJUSTMENT',
          amount: correctionAmount,
          balanceBefore: currentBalance,
          balanceAfter: calculatedBalance,
          reason: `RECONCILIATION_CORRECTION_DISCREPANCY_${discrepancy}`,
          referenceId: 'reconcile_tool',
          createdAt: nowIso
        });
      }

      serverLogger.info('ECONOMY_RECONCILIATION_FIXED', `Automatically corrected user ${userId} balance from ${currentBalance} to ${calculatedBalance}`, {
        userId,
        discrepancy,
        correctionAmount,
        fixedBalance: calculatedBalance
      });

      currentBalance = calculatedBalance;
      discrepancy = 0;
      isReconciled = true;
      fixed = true;
    }
  }

  return {
    userId,
    initialBalance: INITIAL_BALANCE,
    totalCredits,
    totalDebits,
    calculatedBalance,
    actualBalance: currentBalance,
    discrepancy,
    isReconciled,
    transactionCount: userTransactions.length,
    timestamp: new Date().toISOString(),
    fixed
  };
}
