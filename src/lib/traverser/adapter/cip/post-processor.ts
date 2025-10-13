/**
 * CIP Post-Processor
 *
 * Enhances CIP/EtherNet-IP metrics with device identification.
 */

import log from '../../lib/infrastructure/logger';
import type { CipOptions, TelegrafMetric } from './types';

/**
 * CIP post-processor - adds device identification
 */
export async function cipPostProcessor(
  agent: string,
  port: number,
  options: CipOptions,
  metrics: TelegrafMetric[],
): Promise<TelegrafMetric[]> {
  log.verbose(`Processing CIP metrics for ${agent}:${port}`);

  // The native CIP implementation already includes all device info
  // This post-processor is mainly for compatibility and potential future enhancements

  return metrics;
}
