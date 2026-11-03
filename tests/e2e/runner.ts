import { spawn } from 'child_process';
import path from 'path';

/**
 * IdleNyah E2E Standalone Test Runner
 * Executes all 4 tiers of E2E acceptance tests and outputs a structured summary report.
 */
export async function runE2ETests(): Promise<boolean> {
  console.log('======================================================================');
  console.log('            IDLENYAH END-TO-END TEST SUITE (TIERS 1 - 4)              ');
  console.log('======================================================================');
  console.log('Running requirement-driven opaque-box tests across 4 progressive tiers:');
  console.log('  - Tier 1: Feature Coverage (R1 - R6 in isolation)');
  console.log('  - Tier 2: Boundary & Corner Cases (limits, zero, negatives, overflow)');
  console.log('  - Tier 3: Cross-Feature Combinations (pairwise system interactions)');
  console.log('  - Tier 4: Real-World Gameplay Scenarios (multi-minute simulations)');
  console.log('----------------------------------------------------------------------\n');

  const configPath = 'tests/e2e/vitest.config.ts';
  const isWindows = process.platform === 'win32';
  const npxCmd = isWindows ? 'npx.cmd' : 'npx';

  return new Promise<boolean>((resolve) => {
    const startTime = Date.now();
    const child = spawn(npxCmd, ['vitest', 'run', '--config', configPath], {
      stdio: 'inherit',
      cwd: process.cwd(),
      shell: isWindows,
    });

    child.on('close', (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log('\n----------------------------------------------------------------------');
      if (code === 0) {
        console.log(`[PASS] ALL 4 TIERS OF E2E TESTS COMPLETED SUCCESSFULLY in ${elapsed}s`);
        console.log('======================================================================');
        resolve(true);
      } else {
        console.error(`[FAIL] E2E TEST SUITE ENCOUNTERED FAILURES (Exit code: ${code})`);
        console.log('======================================================================');
        resolve(false);
      }
    });

    child.on('error', (err) => {
      console.error('[ERROR] Failed to spawn Vitest runner process:', err);
      resolve(false);
    });
  });
}

// Direct CLI invocation
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('runner.ts')) {
  runE2ETests().then((success) => {
    process.exit(success ? 0 : 1);
  });
}
