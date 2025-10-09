/**
 * Process Detector - Detects multiple running instances of the bot
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Detect running Node.js processes that might be other bot instances
 * @returns {Promise<Array>} List of detected processes
 */
async function detectBotProcesses() {
    const currentPid = process.pid;
    const detectedProcesses = [];

    try {
        // Different commands for different platforms
        const isWindows = process.platform === 'win32';
        let command;
        
        if (isWindows) {
            // Windows: Use tasklist to find node processes
            command = 'tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH';
        } else {
            // Unix/Linux/Mac: Use ps to find node processes
            command = 'ps aux | grep node | grep -v grep';
        }

        const { stdout, stderr } = await execAsync(command);
        
        if (isWindows) {
            // Parse Windows tasklist output (CSV format)
            const lines = stdout.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                // CSV format: "name","pid","session","session#","mem"
                const match = line.match(/"([^"]+)","(\d+)"/);
                if (match) {
                    const pid = parseInt(match[2]);
                    if (pid !== currentPid) {
                        detectedProcesses.push({
                            pid,
                            name: match[1],
                            current: false
                        });
                    } else {
                        detectedProcesses.push({
                            pid,
                            name: match[1],
                            current: true
                        });
                    }
                }
            }
        } else {
            // Parse Unix ps output
            const lines = stdout.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                    const pid = parseInt(parts[1]);
                    if (!isNaN(pid)) {
                        detectedProcesses.push({
                            pid,
                            command: parts.slice(10).join(' '),
                            current: pid === currentPid
                        });
                    }
                }
            }
        }

        return detectedProcesses;

    } catch (error) {
        console.error('Failed to detect processes:', error.message);
        return [{ pid: currentPid, current: true, error: 'Detection failed' }];
    }
}

/**
 * Log process information with formatting
 */
function logProcessInfo(processes) {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 PROCESS DETECTION REPORT');
    console.log('='.repeat(60));
    console.log(`Current PID: ${process.pid}`);
    console.log(`Platform: ${process.platform}`);
    console.log(`Node Version: ${process.version}`);
    console.log(`Total Node Processes Found: ${processes.length}`);
    console.log('');

    if (processes.length === 0) {
        console.log('⚠️  No processes detected (detection may have failed)');
    } else if (processes.length === 1 && processes[0].current) {
        console.log('✅ Only ONE instance detected (this one)');
    } else {
        console.log('⚠️  MULTIPLE NODE PROCESSES DETECTED:');
        console.log('');
        
        processes.forEach((proc, index) => {
            const marker = proc.current ? '👉 ' : '   ';
            const label = proc.current ? '[THIS INSTANCE]' : '[OTHER PROCESS]';
            console.log(`${marker}Process ${index + 1}: PID ${proc.pid} ${label}`);
            if (proc.command) {
                console.log(`   Command: ${proc.command.substring(0, 80)}`);
            }
            if (proc.error) {
                console.log(`   Error: ${proc.error}`);
            }
            console.log('');
        });

        // Warning if multiple processes detected
        const otherProcesses = processes.filter(p => !p.current);
        if (otherProcesses.length > 0) {
            console.log('🚨 WARNING: OTHER NODE PROCESSES ARE RUNNING!');
            console.log('   This could cause duplicate responses if they are bot instances.');
            console.log(`   Other PIDs: ${otherProcesses.map(p => p.pid).join(', ')}`);
        }
    }

    console.log('='.repeat(60) + '\n');
}

module.exports = {
    detectBotProcesses,
    logProcessInfo
};
