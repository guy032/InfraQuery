/**
 * BACnet Concurrency Manager
 *
 * Limits concurrent BACnet scans to avoid UDP socket conflicts
 * while still allowing other protocols to run in full parallel
 */

import log from '../../lib/infrastructure/logger';

class BACnetConcurrencyManager {
  private maxConcurrent: number;

  private activeScans = 0;

  private queue: Array<() => void> = [];

  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Acquire a slot for BACnet scanning
   * Returns a promise that resolves when a slot is available
   */
  async acquire(): Promise<void> {
    if (this.activeScans < this.maxConcurrent) {
      this.activeScans++;
      log.debug(`BACnet: Acquired scan slot (${this.activeScans}/${this.maxConcurrent} active)`);

      return;
    }

    // Wait for a slot to become available
    return new Promise((resolve) => {
      this.queue.push(resolve);
      log.debug(
        `BACnet: Waiting for scan slot (${this.activeScans}/${this.maxConcurrent} active, ${this.queue.length} queued)`,
      );
    });
  }

  /**
   * Release a slot after BACnet scanning completes
   */
  release(): void {
    this.activeScans--;
    log.debug(`BACnet: Released scan slot (${this.activeScans}/${this.maxConcurrent} active)`);

    // Process next queued scan if any
    if (this.queue.length > 0) {
      const next = this.queue.shift();

      if (next) {
        this.activeScans++;
        next();
      }
    }
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      active: this.activeScans,
      queued: this.queue.length,
      max: this.maxConcurrent,
    };
  }
}

// Singleton instance - shared across all BACnet scans
const bacnetConcurrency = new BACnetConcurrencyManager(5); // Max 5 concurrent BACnet scans

export default bacnetConcurrency;
