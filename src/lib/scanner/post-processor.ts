/**
 * Post-Processing Module
 * 
 * Functions to post-process scan results, including port classification
 * corrections and other heuristics.
 */

import { Results } from './types';

/**
 * Correct port 9100 classification
 * 
 * Changes port 9100 from "prometheus" to "pdl" (Printer Data Language)
 * if printer-related ports are detected on the same host.
 * 
 * Printer ports checked:
 * - TCP 515 (lpd - Line Printer Daemon)
 * - TCP 631 (ipp - Internet Printing Protocol)
 * - UDP 3702 (wsd - Web Services Discovery)
 */
export function correctPort9100Classification(results: Results): void {
    let corrections = 0;
    
    for (const [ip, host] of Object.entries(results.hosts)) {
        const tcpPorts = host.ports.tcp || {};
        const udpPorts = host.ports.udp || {};
        
        // Check if port 9100 is labeled as prometheus
        if (tcpPorts[9100] === 'prometheus') {
            // Check for printer-related ports
            const hasPrinterPorts = 
                tcpPorts[515] === 'lpd' ||
                tcpPorts[631] === 'ipp' ||
                udpPorts[3702] === 'wsd';
            
            if (hasPrinterPorts) {
                tcpPorts[9100] = 'pdl';  // Change to PDL (Printer Data Language)
                corrections++;
                console.error(`[POST-PROCESS] ${ip}: Changed port 9100 from prometheus -> pdl (printer detected)`);
            }
        }
    }
    
    if (corrections > 0) {
        console.error(`[POST-PROCESS] Corrected ${corrections} port 9100 classification(s)`);
    }
}

/**
 * Apply all post-processing corrections
 */
export function postProcessResults(results: Results): void {
    correctPort9100Classification(results);
    // Add more post-processing functions here as needed
}

