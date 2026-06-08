const express = require("express");
const cors = require("cors");
const path = require("path");
const { parsePrompt } = require("./agent");
const { runCommand, getActiveProcessPromise } = require("./ledger-cli");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Serve frontend assets
app.use(express.static(path.join(__dirname, "../public")));

// Cache for active transaction during signing phase
let activeTx = null;

/**
 * Endpoint to process natural language prompt
 */
app.post("/api/agent/process", async (req, res) => {
  const { prompt, isSimulated = false } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    // 1. Parse natural language into structured action
    const action = parsePrompt(prompt);

    // 2. Map to wallet-cli command string
    let commandStr = "";
    if (action.type === "GENUINE_CHECK") {
      commandStr = "wallet-cli genuine-check";
    } else if (action.type === "BALANCE_CHECK") {
      commandStr = `wallet-cli balances ${action.network}-0`;
    } else if (action.type === "SWAP") {
      commandStr = `wallet-cli swap execute --from ethereum --to bitcoin --amount ${action.amount}`;
    } else if (action.type === "SEND") {
      commandStr = `wallet-cli send ${action.network}-0 --to ${action.to} --amount '${action.amount} ${action.ticker}'`;
    } else {
      return res.json({
        success: false,
        action,
        stdout: "Agent: I couldn't understand that instruction. Try typing 'Balances', 'Genuine Check', or 'Send 0.05 ETH to 0x...'\n",
        stderr: ""
      });
    }

    // 3. Execute command
    let result;
    let fallbackToSim = false;
    let fallbackReason = "";

    if (!isSimulated) {
      // Execute in Real Mode
      result = await runCommand(commandStr, false);
      
      // If it failed (e.g. command not found, no device connected)
      if (!result.success) {
        fallbackToSim = true;
        fallbackReason = result.stderr || "No device found";
      }
    }

    if (isSimulated || fallbackToSim) {
      // Execute in Simulation Mode
      result = await runCommand(commandStr, true);
      
      if (fallbackToSim) {
        // Prepend warning logs to stdout
        const reasonClean = fallbackReason.replace(/Command failed: /, "").trim();
        result.stdout = `[SYSTEM WARNING] Real CLI execution failed.\nReason: ${reasonClean}\n[SYSTEM] Automatically falling back to SIMULATION MODE to demonstrate the signing flow...\n\n${result.stdout}`;
        result.fallbackTriggered = true;
      }
    }

    // If it requires human confirmation (signing gate)
    if (result.signingRequired) {
      activeTx = {
        action,
        commandStr,
        txDetails: result.txDetails,
        isSimulated: isSimulated || fallbackToSim
      };

      return res.json({
        success: true,
        action,
        commandStr,
        stdout: result.stdout,
        signingRequired: true,
        txDetails: result.txDetails,
        fallbackTriggered: result.fallbackTriggered
      });
    }

    // Direct read-only command output
    return res.json({
      success: true,
      action,
      commandStr,
      stdout: result.stdout,
      stderr: result.stderr,
      fallbackTriggered: result.fallbackTriggered
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Endpoint to confirm/reject active transaction (HITL gate)
 */
app.post("/api/agent/confirm", async (req, res) => {
  const { isApproved } = req.body;

  if (!activeTx) {
    return res.status(400).json({ error: "No active transaction to sign" });
  }

  const tx = activeTx;
  activeTx = null;

  if (tx.isSimulated) {
    // Simulated confirmation
    if (isApproved) {
      const randomHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      return res.json({
        success: true,
        action: tx.action,
        commandStr: tx.commandStr,
        stdout: `✔ Signed → broadcast → ${randomHash}\n`,
        stderr: ""
      });
    } else {
      return res.json({
        success: false,
        action: tx.action,
        commandStr: tx.commandStr,
        stdout: "Error: User rejected transaction on device.\n",
        stderr: "UserRejectionError"
      });
    }
  } else {
    // REAL MODE: Await active subprocess completion
    const promise = getActiveProcessPromise();
    
    if (promise) {
      console.log(`[Server] Awaiting active CLI process completion...`);
      const result = await promise;
      
      return res.json({
        success: result.success,
        action: tx.action,
        commandStr: tx.commandStr,
        stdout: result.stdout,
        stderr: result.stderr
      });
    } else {
      return res.json({
        success: false,
        action: tx.action,
        commandStr: tx.commandStr,
        stdout: "Error: Active ledger signing process has closed or is not found.\n",
        stderr: "NoActiveProcess"
      });
    }
  }
});

// Serve frontend index on fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Ledger Agent Challenge App running at:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`====================================================`);
});
