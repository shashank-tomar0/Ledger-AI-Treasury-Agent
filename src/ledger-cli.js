const { spawn, exec } = require("child_process");

// In-memory session state for simulated accounts
let simulatedSession = {
  isGenuine: null,
  discovered: {
    ethereum: false,
    solana: false,
    bitcoin: false
  },
  accounts: {
    "ethereum-0": {
      address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      balances: ["1.492 ETH", "250.00 USDT"],
      path: "m/44h/60h/0h/0/0"
    },
    "solana-0": {
      address: "7EcDBkPmQa9r3fVw3fVwQa9r7EcDBkPm",
      balances: ["24.50 SOL", "120.00 USDC"],
      path: "m/44h/501h/0h/0h"
    },
    "bitcoin-0": {
      address: "bc1qbc1qbc1qbc1qbc1qbc1qbc1qbc1q",
      balances: ["0.042 BTC"],
      path: "m/84h/0h/0h/0/0"
    }
  }
};

// Subprocess tracking for Real Mode
let activeProcess = null;
let activeProcessPromise = null;
let activeProcessResolver = null;

/**
 * Parses transaction details from the stdout stream of wallet-cli
 */
function parseTxDetailsFromStdout(stdout) {
  const details = {};
  
  // Extract To address
  const toMatch = stdout.match(/To:\s+([0-9a-zA-Z]+)/i);
  if (toMatch) details.to = toMatch[1];
  
  // Extract Amount
  const amountMatch = stdout.match(/Amount:\s+([0-9.]+\s*[a-zA-Z]+)/i);
  if (amountMatch) details.amount = amountMatch[1];
  
  // Extract Fees
  const feesMatch = stdout.match(/Fees:\s+([0-9.]+\s*[a-zA-Z]+)/i);
  if (feesMatch) details.fees = feesMatch[1];

  // Check if swap
  if (stdout.toLowerCase().includes("swap") || stdout.toLowerCase().includes("provider")) {
    details.isSwap = true;
    const fromMatch = stdout.match(/from:\s+([0-9.]+\s*[a-zA-Z0-9_]+)/i);
    if (fromMatch) details.fromAmount = fromMatch[1];
    const toMatchSwap = stdout.match(/to:\s+([0-9.]+\s*[a-zA-Z0-9_]+)/i);
    if (toMatchSwap) details.toAmount = toMatchSwap[1];
    const providerMatch = stdout.match(/provider:\s+([a-zA-Z0-9]+)/i);
    if (providerMatch) details.provider = providerMatch[1];
  }
  
  return details;
}

/**
 * Executes a CLI command (Real or Simulated)
 */
function runCommand(commandStr, isSimulated = true) {
  if (isSimulated) {
    return simulateCLI(commandStr);
  } else {
    return runCommandReal(commandStr);
  }
}

/**
 * Spawns the real wallet-cli process and monitors its stdout stream
 */
function runCommandReal(commandStr) {
  // If there's an existing active process, terminate it
  if (activeProcess) {
    try {
      activeProcess.kill();
    } catch (e) {}
    activeProcess = null;
    activeProcessPromise = null;
    activeProcessResolver = null;
  }

  return new Promise((resolve) => {
    // Standardize command for Windows (convert alias if needed)
    // Replace 'wallet-cli' with 'npx @ledgerhq/wallet-cli' to ensure it runs even if global path is not updated
    const finalCommand = commandStr.replace(/^wallet-cli/, "npx @ledgerhq/wallet-cli");
    const args = finalCommand.split(" ");
    const cmd = args[0];
    const cmdArgs = args.slice(1);

    logToFile(`Spawning Real CLI: ${cmd} ${cmdArgs.join(" ")}`);

    const child = spawn(cmd, cmdArgs, { shell: true });
    activeProcess = child;

    let stdoutData = "";
    let stderrData = "";
    let isSigningPrompted = false;

    // Create a promise that resolves when the process exits
    activeProcessPromise = new Promise((resolveExit) => {
      activeProcessResolver = resolveExit;
    });

    child.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdoutData += chunk;
      logToFile(`CLI STDOUT: ${chunk}`);

      // Check if wallet-cli is asking for on-device confirmation
      if (
        (chunk.includes("Review") || 
         chunk.includes("Approve or reject") || 
         chunk.includes("Confirm or reject") || 
         chunk.includes("Review the swap")) &&
        !isSigningPrompted
      ) {
        isSigningPrompted = true;
        
        // Resolve early so index.js can send the signing request to the UI
        resolve({
          success: true,
          stdout: stdoutData,
          stderr: stderrData,
          signingRequired: true,
          txDetails: parseTxDetailsFromStdout(stdoutData)
        });
      }
    });

    child.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderrData += chunk;
      logToFile(`CLI STDERR: ${chunk}`);
    });

    child.on("close", (code) => {
      logToFile(`CLI Process Exited with code ${code}`);
      
      const result = {
        success: code === 0,
        stdout: stdoutData,
        stderr: stderrData || (code !== 0 ? `Process exited with error code ${code}` : ""),
        code
      };

      // Resolve the exit promise
      if (activeProcessResolver) {
        activeProcessResolver(result);
      }

      // If we haven't resolved the main command promise yet (e.g. read-only commands)
      if (!isSigningPrompted) {
        resolve(result);
      }

      // Cleanup
      activeProcess = null;
      activeProcessPromise = null;
      activeProcessResolver = null;
    });

    child.on("error", (err) => {
      logToFile(`CLI Process Error: ${err.message}`);
      const result = {
        success: false,
        stdout: stdoutData,
        stderr: err.message,
        code: -1
      };

      if (activeProcessResolver) {
        activeProcessResolver(result);
      }

      if (!isSigningPrompted) {
        resolve(result);
      }

      activeProcess = null;
      activeProcessPromise = null;
      activeProcessResolver = null;
    });
  });
}

/**
 * Helper to get the promise for the active process exit
 */
function getActiveProcessPromise() {
  return activeProcessPromise;
}

/**
 * Simulated wallet-cli output stream
 */
function simulateCLI(commandStr) {
  return new Promise((resolve) => {
    const args = commandStr.split(" ");
    const cmd = args[1];

    setTimeout(() => {
      // 1. Genuine Check
      if (cmd === "genuine-check") {
        simulatedSession.isGenuine = true;
        resolve({
          success: true,
          stdout: "✔ Device is genuine\n",
          stderr: ""
        });
        return;
      }

      // 2. Account Discover
      if (cmd === "account" && args[2] === "discover") {
        const network = args[3] || "ethereum";
        simulatedSession.discovered[network] = true;
        
        let output = "";
        if (network === "ethereum") {
          output = `ethereum:main account #0 0x71C7656EC7ab88b098defB751B7401B5f6d8976F\nethereum:main account #1 0x9A44047F37a2b9e6231c51d7e68c91d3e69123e4\n`;
        } else if (network === "solana") {
          output = `solana:main account #0 7EcDBkPmQa9r3fVw3fVwQa9r7EcDBkPm\n`;
        } else if (network === "bitcoin") {
          output = `bitcoin:main account #0 bc1qbc1qbc1qbc1qbc1qbc1qbc1qbc1q\n`;
        }

        resolve({
          success: true,
          stdout: output + `\nDiscovered accounts saved to local session.`,
          stderr: ""
        });
        return;
      }

      // 3. Balances
      if (cmd === "balances") {
        const label = args[2] || "ethereum-0";
        const account = simulatedSession.accounts[label] || simulatedSession.accounts["ethereum-0"];
        
        let stdout = "✔ Balances fetched\n";
        account.balances.forEach(b => {
          stdout += `  ${b}\n`;
        });

        resolve({
          success: true,
          stdout: stdout,
          stderr: ""
        });
        return;
      }

      // 4. Send (Dry-run / Prep phase)
      if (cmd === "send") {
        const label = args[2] || "ethereum-0";
        
        // Find flags
        const toIdx = args.indexOf("--to");
        const toVal = toIdx !== -1 ? args[toIdx + 1] : "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
        const amtIdx = args.indexOf("--amount");
        const amtVal = amtIdx !== -1 ? args[amtIdx + 1].replace(/'/g, "") : "0.05 ETH";

        const fees = amtVal.includes("ETH") ? "0.000312 ETH" : (amtVal.includes("SOL") ? "0.000005 SOL" : "0.00012 BTC");

        const stdout = `To:      ${toVal}
Amount:  ${amtVal}
Fees:    ${fees}
[⧖] Review on device. Approve or reject.
`;
        resolve({
          success: true,
          stdout: stdout,
          stderr: "",
          signingRequired: true,
          txDetails: {
            to: toVal,
            amount: amtVal,
            fees: fees
          }
        });
        return;
      }

      // 5. Swap (Dry-run / Prep phase)
      if (cmd === "swap" && args[2] === "execute") {
        const fromIdx = args.indexOf("--amount");
        const amtVal = fromIdx !== -1 ? args[fromIdx + 1] : "0.1";
        
        const stdout = `from:     ${amtVal} ETH ($380.00)
to:       ${(amtVal * 3800).toFixed(2)} USDT ($380.00)
provider: changelly
[⧖] Review the swap on your Ledger. Confirm or reject.
`;

        resolve({
          success: true,
          stdout: stdout,
          stderr: "",
          signingRequired: true,
          txDetails: {
            isSwap: true,
            fromAmount: `${amtVal} ETH`,
            toAmount: `${(amtVal * 3800).toFixed(2)} USDT`,
            provider: "changelly"
          }
        });
        return;
      }

      // Default fallback
      resolve({
        success: true,
        stdout: `Command: ${commandStr} executed successfully.`,
        stderr: ""
      });

    }, 800);
  });
}

function logToFile(msg) {
  console.log(`[Ledger-CLI-Wrapper] ${msg}`);
}

module.exports = {
  runCommand,
  getActiveProcessPromise,
  simulatedSession
};
