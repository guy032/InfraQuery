/**
 * Privilege Checking Utilities
 * 
 * Functions to check if the process has elevated privileges (root/admin)
 * required for network scanning operations.
 */

import * as os from 'os';
import { execSync } from 'child_process';

/**
 * Check if the process is running with elevated privileges
 * @returns true if running with elevated privileges, false otherwise
 */
export function hasElevatedPrivileges(): boolean {
    const platform = os.platform();
    
    try {
        if (platform === 'win32') {
            // Windows: Check if running as Administrator
            try {
                execSync('net session', { stdio: 'ignore' });
                return true;
            } catch {
                return false;
            }
        } else {
            // Unix-like systems (Linux, macOS): Check if running as root
            return process.getuid ? process.getuid() === 0 : false;
        }
    } catch {
        return false;
    }
}

/**
 * Exit the process gracefully if not running with elevated privileges
 */
export function requireElevatedPrivileges(): void {
    if (!hasElevatedPrivileges()) {
        const platform = os.platform();
        console.error('========================================');
        console.error('ERROR: Elevated privileges required');
        console.error('========================================');
        console.error('');
        console.error('This network scanner requires elevated privileges to:');
        console.error('  • Send ICMP ping packets');
        console.error('  • Perform TCP SYN scanning');
        console.error('  • Scan UDP ports');
        console.error('');
        
        if (platform === 'win32') {
            console.error('Please run this command as Administrator:');
            console.error('  1. Right-click on your terminal/command prompt');
            console.error('  2. Select "Run as Administrator"');
            console.error('  3. Run: yarn dev or npm run dev');
        } else if (platform === 'darwin') {
            console.error('Please run with sudo:');
            console.error('  sudo yarn dev');
            console.error('  or');
            console.error('  sudo npm run dev');
        } else {
            console.error('Please run with sudo:');
            console.error('  sudo yarn dev');
            console.error('  or');
            console.error('  sudo npm run dev');
        }
        
        console.error('');
        console.error('========================================');
        process.exit(1);
    }
}

