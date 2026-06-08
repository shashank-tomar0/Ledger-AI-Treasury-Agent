# ⚿ Ledger AI Treasury Agent & college.xyz Bounty Clone

> **"Intelligence is soft. Action is programmatic. Control must be hardware-enforced."**

This repository is a submission for **Lane C ("Build Something Real")** of the **Ledger Agent Stack** developer challenge. It replicates the exact retro-brutalist UI and layout of the **college.xyz** bounty portal (`college.xyz/clone-builder`) as shown in the brief, and embeds a fully interactive **AI Treasury Agent Terminal** + **Virtual Ledger Flex Device** to demonstrate the hardware-in-the-loop signing flow.

---

## 🎯 The Core Thesis: Software-Only Security is a Ticking Time Bomb

Autonomous AI agents are already executing blockchain transactions, rebalancing treasuries, and trading on-chain. Yet, the vast majority of these agents operate on **software-only secrets**—private keys stored as environment variables in `.env` files, locked in database tables, or loaded in memory.

### Why Software-Only Fails:
1. **Copyable and Stealable:** Anyone with access to the host server, backup logs, or runtime environment can copy the private key. Once copied, it is gone.
2. **No Human Circuit Breaker:** An LLM-based agent can suffer from hallucination loops, smart contract bugs, or fall victim to **prompt injection attacks**. Without a physical barrier, a compromised agent can execute unauthorized drainage transactions in milliseconds.
3. **High Stakes, Zero Guardrails:** Software cannot enforce a deterministic physical boundary. It lacks a physical screen that is decoupled from the internet.

### The Ledger Solution:
The **Ledger Agent Stack** introduces the missing layer of agentic autonomy: **deterministic, hardware-enforced guardrails**.
By anchoring keys inside a Ledger Secure Element, the agent is restricted to *assembling* transactions and proposing them. The transaction *cannot* be signed or broadcast without a physical review and approval gate on the Ledger device screen. **Agents propose; humans verify.**

---

## 🏗️ 4 Open-Source Primitives Shipped by Ledger

This project highlights the four components shipped in Ledger's new AI Agent stack:
1. **DMK Skills:** Structured instruction sets (ETH/BTC/SOL/Cosmos + FIDO2) that teach coding agents (like Claude Code, Cursor, and Cline) how to integrate the Device Management Kit into client-side apps.
2. **Ledger Wallet CLI:** The runtime terminal utility (`@ledgerhq/wallet-cli`) allowing agents to run balance checks, account discoveries, swaps, and token transfers with physical hardware checks.
3. **Ledger Enterprise CLI:** Programmatic signing integration with HSM-anchored multisig policies for treasury workflows.
4. **Ledger Multisig CLI:** Multi-device programmed operations (like payroll or yield harvests) where the final signing step resides on physical Ledger hardware.

---

## 🎮 The Interactive Playground Features

To allow developers and judges to verify the flow immediately (even without physical hardware on hand), the application operates in **two modes**:

### 1. Real Mode (Default)
- Runs actual shell commands calling the global/local `@ledgerhq/wallet-cli` executable.
- Uses transport protocols to interact with either a connected USB Ledger device or a local **Speculos** device emulator.

### 2. Simulation Mode (Fallback)
- Interacts with a simulated wrapper of the `@ledgerhq/wallet-cli` binary.
- Triggers realistic terminal outputs for `genuine-check`, `balances`, and `send/swap` executions.
- **Virtual Ledger Flex:** When a transaction is prepared, the dashboard renders a visual mockup of a Ledger Flex screen. You can review the asset, amount, destination address, and gas fees, and physically click the **Approve** or **Reject** buttons to watch the agent complete or halt the transaction broadcast.

---

## 🚀 Quickstart Guide

### 1. Prerequisites
Ensure you have **Node.js** (v20+) installed on your machine.

### 2. Installation
Clone this repository and install the dependencies:
```bash
git clone https://github.com/JCodesMore/ai-website-cloner-template.git my-clone
cd my-clone
npm install
```

### 3. Run the App
Start the local Express server:
```bash
npm start
```
Open your browser and navigate to:
👉 [http://localhost:8080](http://localhost:8080)

---

## 🔌 Running with Speculos Emulator

To demonstrate the stack end-to-end without a physical device, you can use **Speculos**, Ledger's open-source device emulator:

1. **Install Speculos:**
   Follow the guide on the [Speculos GitHub Repository](https://github.com/LedgerHQ/speculos) to build it or run it via Docker (if available on your OS).
   
2. **Run a Ledger App on Speculos:**
   Launch the emulator with the Ethereum or Solana app binary:
   ```bash
   speculos --model flex apps/ethereum.elf
   ```
   Speculos will start a TCP server for APDUs on port `9999` and an HTTP API on port `5000`.

3. **Configure Transport for Wallet-CLI:**
   Point the Ledger Wallet CLI to the emulator using the proxy environment variables:
   ```bash
   export LEDGER_PROXY_ADDRESS=127.0.0.1
   export LEDGER_PROXY_PORT=9999
   ```

4. **Toggle Real Mode:**
   Switch the dashboard's mode toggle to **REAL CLI**. Transactions initiated from the Agent Console will now call the actual `wallet-cli` binary and forward the signing request to your emulated Speculos screen!

---

## 📂 Codebase Structure
- `src/index.js` - Express API server and execution routing.
- `src/agent.js` - Rule-based NLP translator mapping prompts to structured JSON actions.
- `src/ledger-cli.js` - CLI execution and high-fidelity output simulator.
- `public/index.html` - Premium `college.xyz` replica HTML layout.
- `public/style.css` - Brutalist CSS styling with dot-grids, borders, and corner handles.
- `public/app.js` - Playground chat controller and visual device state machine.
