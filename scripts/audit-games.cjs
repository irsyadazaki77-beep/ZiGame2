const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const gamesDir = path.join(rootDir, 'src', 'components', 'games');
const registryPath = fs.existsSync(path.join(rootDir, 'src', 'config', 'gameRegistry.ts'))
  ? path.join(rootDir, 'src', 'config', 'gameRegistry.ts')
  : path.join(rootDir, 'src', 'config', 'gamesRegistry.ts');

const registryContent = fs.existsSync(registryPath)
  ? fs.readFileSync(registryPath, 'utf8')
  : '';

/**
 * Parse CANONICAL_GAME_REGISTRY entries from gameRegistry.ts
 * Extracts gameId -> component import path (e.g. "world-box" -> "WorldBoxGame").
 */
function parseRegistryEntries(source) {
  const entries = new Map();
  const blockRegex = /'([a-z0-9-]+)'\s*:\s*\{[\s\S]*?component:\s*lazy\(\(\)\s*=>\s*import\(['"]\.\.\/components\/games\/([^'"]+)['"]\)\)/g;
  let match;
  while ((match = blockRegex.exec(source)) !== null) {
    entries.set(match[1], match[2].replace(/\.(tsx|ts)$/, ''));
  }
  return entries;
}

/**
 * Recursively collects all .ts/.tsx files inside a modular game directory.
 */
function collectModuleFiles(dirPath) {
  const collected = [];
  if (!fs.existsSync(dirPath)) return collected;
  const dirEntries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of dirEntries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectModuleFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      collected.push(fullPath);
    }
  }
  return collected;
}

/**
 * Converts kebab-case directory name (e.g. "world-box") to PascalCase prefix ("WorldBox").
 */
function kebabToPascal(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

const dirEntries = fs.readdirSync(gamesDir, { withFileTypes: true });

// Pattern A: Single / entry game files in src/components/games/*Game.tsx
const rootGameFiles = dirEntries
  .filter((entry) => entry.isFile() && (entry.name.endsWith('Game.tsx') || entry.name.endsWith('.tsx')))
  .map((entry) => entry.name)
  .sort();

// Pattern B: Modular game directories in src/components/games/<game-name>/
const modularDirs = dirEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const registryMap = parseRegistryEntries(registryContent);
const componentToIds = new Map();
for (const [id, compName] of registryMap.entries()) {
  if (!componentToIds.has(compName)) {
    componentToIds.set(compName, []);
  }
  componentToIds.get(compName).push(id);
}

// Map each modular directory to its entry component & internal module files
const modularGames = new Map(); // entryFile -> { dirName, moduleFiles }
const orphanModularDirs = [];

for (const dirName of modularDirs) {
  const dirFullPath = path.join(gamesDir, dirName);
  const moduleFiles = collectModuleFiles(dirFullPath);
  const pascalPrefix = kebabToPascal(dirName);

  // Match entry component in root games dir (e.g. BrickBreakerGame.tsx, NeonHeistGame.tsx, WorldBoxGame.tsx)
  // or via registry id match or index.tsx inside dirName
  const registryComp = registryMap.get(dirName);
  const expectedEntry =
    (registryComp && rootGameFiles.includes(`${registryComp}.tsx`) && `${registryComp}.tsx`) ||
    rootGameFiles.find((f) => f === `${pascalPrefix}Game.tsx` || f === `${pascalPrefix}3DGame.tsx`) ||
    (fs.existsSync(path.join(dirFullPath, 'index.tsx')) ? `${dirName}/index.tsx` : null);

  if (expectedEntry) {
    modularGames.set(expectedEntry, {
      dirName,
      moduleFiles,
      relativeFiles: moduleFiles.map((f) => path.relative(gamesDir, f).replace(/\\/g, '/')),
    });
  } else {
    orphanModularDirs.push(dirName);
  }
}

const result = {
  shared2DLoop: [],
  shared3DWebGL: [],
  sharedEventDriven: [],
  modularArchitecture: [],
  legacy: [],
  rawRafViolations: [],
  listenerLeakViolations: [],
  threeDisposeViolations: [],
  unregisteredFiles: [],
  missingRegistryTargets: [],
};

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
}

// Analyze all discovered games (root entry files + modular directories)
const analyzedEntries = new Set([...rootGameFiles, ...modularGames.keys()]);

Array.from(analyzedEntries)
  .sort()
  .forEach((entryRelPath) => {
    const entryFullPath = path.join(gamesDir, entryRelPath);
    if (!fs.existsSync(entryFullPath)) return;

    const entryContent = fs.readFileSync(entryFullPath, 'utf8');
    const modInfo = modularGames.get(entryRelPath);
    const allFiles = modInfo ? [entryFullPath, ...modInfo.moduleFiles] : [entryFullPath];
    const modContent = modInfo
      ? modInfo.moduleFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n')
      : '';
    const combinedContent = `${entryContent}\n${modContent}`;

    const baseName = path.basename(entryRelPath, '.tsx');
    const hasUseGameEngine = combinedContent.includes('useGameEngine');
    const hasStartLoop =
      combinedContent.includes('startLoop') ||
      combinedContent.includes('ThreeStageController');
    const is3DWebGL =
      combinedContent.includes("'three'") ||
      combinedContent.includes('"three"') ||
      combinedContent.includes('THREE.WebGLRenderer') ||
      combinedContent.includes('ThreeStageController');

    const label = modInfo
      ? `${entryRelPath} + ${modInfo.dirName}/ (${modInfo.moduleFiles.length} modules)`
      : entryRelPath;

    if (modInfo) {
      result.modularArchitecture.push(label);
    }

    if (!hasUseGameEngine) {
      result.legacy.push(label);
    } else if (is3DWebGL) {
      result.shared3DWebGL.push(label);
    } else if (hasStartLoop) {
      result.shared2DLoop.push(label);
    } else {
      result.sharedEventDriven.push(label);
    }

    // Strict SDK & Lifecycle Hygiene Checks across every file belonging to the game
    for (const filePath of allFiles) {
      const rel = path.relative(gamesDir, filePath).replace(/\\/g, '/');
      const stripped = stripComments(fs.readFileSync(filePath, 'utf8'));

      const rawRafCount = (stripped.match(/\brequestAnimationFrame\s*\(/g) || []).length;
      if (rawRafCount > 0) {
        result.rawRafViolations.push(`${rel} (${rawRafCount}x requestAnimationFrame)`);
      }

      const addEv = (stripped.match(/\.addEventListener\s*\(/g) || []).length;
      const remEv = (stripped.match(/\.removeEventListener\s*\(/g) || []).length;
      const addRO = (stripped.match(/new\s+ResizeObserver\s*\(/g) || []).length;
      const disRO = (stripped.match(/\.disconnect\s*\(/g) || []).length;
      if (addEv !== remEv || addRO > disRO) {
        result.listenerLeakViolations.push(
          `${rel} (add/remove: ${addEv}/${remEv}, ResizeObserver/disconnect: ${addRO}/${disRO})`
        );
      }

      const usesThree = /from\s+['"]three['"]/.test(stripped);
      const hasDispose = /disposeThreeScene|\.dispose\s*\(/.test(stripped);
      if (usesThree && !hasDispose) {
        result.threeDisposeViolations.push(`${rel} (imports 'three' without disposeThreeScene/.dispose)`);
      }
    }

    const isRegisteredInFile =
      componentToIds.has(baseName) || (registryContent && registryContent.includes(baseName));
    if (!isRegisteredInFile) {
      result.unregisteredFiles.push(label);
    }
  });

// Verify every canonical registry entry resolves to an actual component file
for (const [gameId, compName] of registryMap.entries()) {
  const tsxPath = path.join(gamesDir, `${compName}.tsx`);
  const dirIndexPath = path.join(gamesDir, compName, 'index.tsx');
  if (!fs.existsSync(tsxPath) && !fs.existsSync(dirIndexPath)) {
    result.missingRegistryTargets.push(`${gameId} -> ${compName}`);
  }
}

const totalGames = analyzedEntries.size;
const totalEngineGames =
  result.shared2DLoop.length + result.shared3DWebGL.length + result.sharedEventDriven.length;

console.log(`Total komponen game terdeteksi: ${totalGames} (Terdaftar di gameRegistry.ts: ${registryMap.size})`);
console.log(`Total modular games (<game-name>/): ${result.modularArchitecture.length}`);
console.log(`Total terintegrasi useGameEngine: ${totalEngineGames}/${totalGames} (${totalGames > 0 ? Math.round((totalEngineGames / totalGames) * 100) : 0}% Shared Engine)`);

console.log(
  `\n=== 1. 2D Loop Architecture (useGameEngine + startLoop) (${result.shared2DLoop.length}) ===\n` +
    (result.shared2DLoop.join('\n') || '(Kosong)')
);

console.log(
  `\n=== 2. 3D WebGL Architecture (useGameEngine + Three.js) (${result.shared3DWebGL.length}) ===\n` +
    (result.shared3DWebGL.join('\n') || '(Kosong)')
);

console.log(
  `\n=== 3. Event / Turn-Based Architecture (useGameEngine) (${result.sharedEventDriven.length}) ===\n` +
    (result.sharedEventDriven.join('\n') || '(Kosong)')
);

console.log(
  `\n=== 4. Modular Directory Games (<game-name>/ + entry component) (${result.modularArchitecture.length}) ===\n` +
    (result.modularArchitecture.join('\n') || '(Kosong)')
);

console.log(
  `\n=== 5. Legacy Architecture (Tanpa useGameEngine) (${result.legacy.length}) ===\n` +
    (result.legacy.join('\n') || '(Kosong)')
);

console.log(
  `\n=== 6. SDK Loop & Resource Cleanup Hygiene ===\n` +
    `Raw requestAnimationFrame violations: ${result.rawRafViolations.length}\n` +
    (result.rawRafViolations.length ? result.rawRafViolations.join('\n') + '\n' : '') +
    `Listener / ResizeObserver leak violations: ${result.listenerLeakViolations.length}\n` +
    (result.listenerLeakViolations.length ? result.listenerLeakViolations.join('\n') + '\n' : '') +
    `Missing Three.js disposal violations: ${result.threeDisposeViolations.length}\n` +
    (result.threeDisposeViolations.length ? result.threeDisposeViolations.join('\n') + '\n' : '')
);

console.log(
  `\n=== Status Registrasi di gameRegistry.ts ===\n` +
    `Unregistered files: ${result.unregisteredFiles.length}\n` +
    (result.unregisteredFiles.length ? result.unregisteredFiles.join('\n') + '\n' : '') +
    `Orphan modular dirs: ${orphanModularDirs.length}\n` +
    (orphanModularDirs.length ? orphanModularDirs.join('\n') + '\n' : '') +
    `Missing registry targets: ${result.missingRegistryTargets.length}\n` +
    (result.missingRegistryTargets.length ? result.missingRegistryTargets.join('\n') : `(Semua ${registryMap.size} game canonical & modular sinkron dengan gameRegistry.ts)`)
);

if (
  result.legacy.length > 0 ||
  result.rawRafViolations.length > 0 ||
  result.listenerLeakViolations.length > 0 ||
  result.threeDisposeViolations.length > 0 ||
  result.unregisteredFiles.length > 0 ||
  orphanModularDirs.length > 0 ||
  result.missingRegistryTargets.length > 0
) {
  console.error('\n[AUDIT FAILED]: Terdapat game legacy, raw RAF loop, kebocoran resource, direktori modular yatim, atau ketidaksinkronan dengan gameRegistry.ts!');
  process.exit(1);
} else {
  console.log(`\n[AUDIT PASSED]: Semua ${totalGames} game (termasuk ${result.modularArchitecture.length} game modular) lolos audit SDK terpusat, zero raw RAF, dan zero resource leak.`);
}
