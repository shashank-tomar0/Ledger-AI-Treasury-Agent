/**
   Ledger Agent Stack - Treasury Agent Dashboard Controller
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // State
  let isSimulated = false; // Real mode by default
  let isProcessing = false;
  let activeTxDetails = null;

  // DOM Elements
  const modeSim = document.getElementById("mode-sim");
  const modeReal = document.getElementById("mode-real");
  const consoleOutput = document.getElementById("console-output");
  const consoleInput = document.getElementById("console-input");
  const btnSubmitCmd = document.getElementById("btn-submit-cmd");
  const activeTransportLabel = document.getElementById("active-transport-label");
  const auditTableBody = document.querySelector("#audit-table tbody");
  
  // Quick Scenarios
  const scenarioGenuine = document.getElementById("scenario-genuine");
  const scenarioBalance = document.getElementById("scenario-balance");
  const scenarioSend = document.getElementById("scenario-send");
  const scenarioSwap = document.getElementById("scenario-swap");

  // Device Screens
  const screenIdle = document.getElementById("state-idle");
  const screenGenuineSuccess = document.getElementById("state-genuine-success");
  const screenBalances = document.getElementById("state-balances");
  const screenSigning = document.getElementById("state-signing");
  const screenSigned = document.getElementById("state-signed");
  const screenRejected = document.getElementById("state-rejected");

  // Device Transaction Fields
  const signTitle = document.getElementById("sign-title");
  const signAmount = document.getElementById("sign-amount");
  const signAddress = document.getElementById("sign-address");
  const signFees = document.getElementById("sign-fees");
  const btnDeviceReject = document.getElementById("btn-device-reject");
  const btnDeviceApprove = document.getElementById("btn-device-approve");

  // Mode Selection Toggle
  modeSim.addEventListener("click", () => {
    isSimulated = true;
    modeSim.classList.add("active");
    modeReal.classList.remove("active");
    activeTransportLabel.innerText = "SIMULATED";
    activeTransportLabel.style.color = "var(--accent-orange)";
    logSystem("Transport switched to [SIMULATION MODE]. No hardware needed.");
  });

  modeReal.addEventListener("click", () => {
    isSimulated = false;
    modeReal.classList.add("active");
    modeSim.classList.remove("active");
    activeTransportLabel.innerText = "REAL (CLI/PROXY)";
    activeTransportLabel.style.color = "var(--accent-green)";
    logSystem("Transport switched to [REAL MODE]. Requires local wallet-cli to be configured.");
  });

  // Quick Scenarios Trigger
  scenarioGenuine.addEventListener("click", () => executeCommand("Genuine Check"));
  scenarioBalance.addEventListener("click", () => executeCommand("Check Balances"));
  scenarioSend.addEventListener("click", () => executeCommand("Send 0.05 ETH to 0x71C7656EC7ab88b098defB751B7401B5f6d8976F"));
  scenarioSwap.addEventListener("click", () => executeCommand("Swap 0.1 ETH to USDT"));

  // Input Submission
  btnSubmitCmd.addEventListener("click", handleSubmit);
  consoleInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  });

  function handleSubmit() {
    const val = consoleInput.value.trim();
    if (val && !isProcessing) {
      executeCommand(val);
      consoleInput.value = "";
    }
  }

  // Device interaction buttons
  btnDeviceApprove.addEventListener("click", () => handleDeviceSign(true));
  btnDeviceReject.addEventListener("click", () => handleDeviceSign(false));

  /**
   * Logs a message into the agent console
   */
  function logMessage(text, className = "") {
    const line = document.createElement("div");
    line.className = `log-line ${className}`;
    line.innerHTML = text;
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  function logSystem(text) {
    logMessage(`[SYSTEM] ${text}`, "system-line");
  }

  function logAgent(text) {
    logMessage(`Agent: ${text}`, "agent-line");
  }

  function logUser(text) {
    logMessage(`User &gt; ${text}`, "user-line");
  }

  function logCLI(text) {
    logMessage(`$ ${text}`, "cli-line");
  }

  /**
   * Changes the Ledger visual screen state
   */
  function setDeviceState(stateEl) {
    const states = [screenIdle, screenGenuineSuccess, screenBalances, screenSigning, screenSigned, screenRejected];
    states.forEach(s => s.classList.add("hidden"));
    stateEl.classList.remove("hidden");
  }

  /**
   * Executes a command by pinging the backend API
   */
  async function executeCommand(promptText) {
    isProcessing = true;
    consoleInput.disabled = true;
    btnSubmitCmd.disabled = true;

    logUser(promptText);
    logSystem("Agent compiling instruction sets...");
    setDeviceState(screenIdle);

    try {
      const response = await fetch("/api/agent/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText, isSimulated })
      });

      const data = await response.json();

      if (data.fallbackTriggered) {
        isSimulated = true;
        modeSim.classList.add("active");
        modeReal.classList.remove("active");
        activeTransportLabel.innerText = "SIMULATED";
        activeTransportLabel.style.color = "var(--accent-orange)";
      }

      if (data.commandStr) {
        logCLI(data.commandStr);
      }

      // Simulate a small delay for execution / CLI output stream
      setTimeout(() => {
        if (data.stdout) {
          logMessage(data.stdout.replace(/\n/g, "<br>"), "cli-line");
        }

        if (data.signingRequired) {
          logAgent("Physical signature required on device. Please review on screen.");
          
          // Populate transaction details on virtual screen
          const details = data.txDetails;
          activeTxDetails = details;

          if (details.isSwap) {
            signTitle.innerText = "Review Swap";
            signAmount.innerText = `${details.fromAmount} to ${details.toAmount}`;
            signAddress.innerText = `Provider: ${details.provider}`;
            signFees.innerText = "Verified by Exchange App";
          } else {
            signTitle.innerText = "Review Tx";
            signAmount.innerText = details.amount;
            signAddress.innerText = details.to;
            signFees.innerText = details.fees;
          }

          setDeviceState(screenSigning);
          
          // Flash the console or make it obvious
          logSystem("Awaiting physical confirmation on Ledger device...");
        } else {
          // Process read-only or instant feedback
          if (data.action.type === "GENUINE_CHECK") {
            setDeviceState(screenGenuineSuccess);
            setTimeout(() => setDeviceState(screenIdle), 2500);
          } else if (data.action.type === "BALANCE_CHECK") {
            setDeviceState(screenBalances);
          } else {
            setDeviceState(screenIdle);
          }
          
          // Reset controls
          isProcessing = false;
          consoleInput.disabled = false;
          btnSubmitCmd.disabled = false;
        }
      }, 1000);

    } catch (err) {
      logSystem(`Execution Error: ${err.message}`);
      isProcessing = false;
      consoleInput.disabled = false;
      btnSubmitCmd.disabled = false;
    }
  }

  /**
   * Handles button click (Approve/Reject) on virtual Ledger Flex
   */
  async function handleDeviceSign(isApproved) {
    if (!isProcessing) return;

    logSystem(isApproved ? "User approved transaction on Ledger device." : "User rejected transaction on Ledger device.");
    setDeviceState(isApproved ? screenSigned : screenRejected);

    try {
      const response = await fetch("/api/agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved })
      });

      const data = await response.json();

      setTimeout(() => {
        if (data.stdout) {
          logMessage(data.stdout.replace(/\n/g, "<br>"), "cli-line");
        }
        
        if (isApproved) {
          logAgent("Transaction successfully signed and broadcasted! The treasury has been updated.");

          // Dynamically prepend to Audit Log table on dashboard
          const row = document.createElement("tr");
          let actionName = "SEND (ETH)";
          let amountStr = "0.05 ETH";

          if (activeTxDetails) {
            if (activeTxDetails.isSwap) {
              actionName = `SWAP ${activeTxDetails.fromAmount.split(' ')[1]}-${activeTxDetails.toAmount.split(' ')[1]}`;
              amountStr = activeTxDetails.fromAmount;
            } else {
              actionName = `SEND (${activeTxDetails.amount.split(' ')[1]})`;
              amountStr = activeTxDetails.amount;
            }
          }

          row.innerHTML = `
            <td>${actionName}</td>
            <td>${amountStr}</td>
            <td><span class="log-status approved">✔ SIGNED</span></td>
          `;
          
          if (auditTableBody) {
            auditTableBody.prepend(row);
          }

        } else {
          logAgent("Transaction failed. Human-in-the-loop rejected the request.");
          
          // Dynamically prepend a rejected entry to Audit Log table
          const row = document.createElement("tr");
          let actionName = "SEND (ETH)";
          let amountStr = "0.05 ETH";

          if (activeTxDetails) {
            if (activeTxDetails.isSwap) {
              actionName = `SWAP ${activeTxDetails.fromAmount.split(' ')[1]}-${activeTxDetails.toAmount.split(' ')[1]}`;
              amountStr = activeTxDetails.fromAmount;
            } else {
              actionName = `SEND (${activeTxDetails.amount.split(' ')[1]})`;
              amountStr = activeTxDetails.amount;
            }
          }

          row.innerHTML = `
            <td>${actionName}</td>
            <td>${amountStr}</td>
            <td><span class="log-status rejected">✖ REJECTED</span></td>
          `;
          
          if (auditTableBody) {
            auditTableBody.prepend(row);
          }
        }

        setTimeout(() => {
          setDeviceState(screenIdle);
          isProcessing = false;
          consoleInput.disabled = false;
          btnSubmitCmd.disabled = false;
          activeTxDetails = null;
        }, 1500);

      }, 1000);

    } catch (err) {
      logSystem(`Confirmation Error: ${err.message}`);
      setDeviceState(screenIdle);
      isProcessing = false;
      consoleInput.disabled = false;
      btnSubmitCmd.disabled = false;
      activeTxDetails = null;
    }
  }
});
