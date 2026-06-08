/**
 * Agent NLP translation engine
 * Parses natural language commands into structured actions
 */

function parsePrompt(prompt) {
  const text = prompt.toLowerCase().trim();

  // 1. Genuine Check
  if (text.includes("genuine") || text.includes("check device") || text.includes("genuine-check")) {
    return {
      type: "GENUINE_CHECK",
      description: "Verify Ledger device authenticity"
    };
  }

  // 2. Balances / Portfolio Snapshot
  if (
    text.includes("balance") || 
    text.includes("portfolio") || 
    text.includes("snapshot") || 
    text.includes("holdings") || 
    text.includes("check treasury")
  ) {
    // Determine network if specified, default to ethereum
    let network = "ethereum";
    if (text.includes("solana") || text.includes("sol")) network = "solana";
    if (text.includes("bitcoin") || text.includes("btc")) network = "bitcoin";

    return {
      type: "BALANCE_CHECK",
      network,
      description: `Fetch portfolio snapshot for ${network.toUpperCase()}`
    };
  }

  // 3. Swap / Exchange
  if (text.includes("swap") || text.includes("exchange") || text.includes("convert")) {
    // Regex to extract amount and currencies: e.g., "swap 0.1 eth to usdt"
    const swapRegex = /(?:swap|convert|exchange)\s+([0-9.]+)\s*([a-z0-9]+)\s+(?:to|for)\s+([a-z0-9]+)/i;
    const match = prompt.match(swapRegex);

    if (match) {
      return {
        type: "SWAP",
        amount: parseFloat(match[1]),
        from: match[2].toUpperCase(),
        to: match[3].toUpperCase(),
        description: `Swap ${match[1]} ${match[2].toUpperCase()} to ${match[3].toUpperCase()}`
      };
    }
  }

  // 4. Send / Disburse / Transfer
  if (
    text.includes("send") || 
    text.includes("disburse") || 
    text.includes("transfer") || 
    text.includes("pay")
  ) {
    // Regex for: "send 0.05 ETH to 0x71C7..."
    const amountRegex = /(?:send|disburse|transfer|pay)\s+([0-9.]+)\s*([a-z0-9]+)/i;
    // Regex for ethereum address: 0x[a-fA-F0-9]{40}
    // Regex for solana address: [1-9A-HJ-NP-Za-km-z]{32,44}
    const ethAddrRegex = /0x[a-fA-F0-9]{40}/;
    const solAddrRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/; // simpler check

    const amountMatch = prompt.match(amountRegex);
    const ethMatch = prompt.match(ethAddrRegex);
    
    let toAddress = null;
    let network = "ethereum";

    if (ethMatch) {
      toAddress = ethMatch[0];
      network = "ethereum";
    } else {
      // Look for a solana address (longer base58 string)
      const solMatch = prompt.match(solAddrRegex);
      if (solMatch) {
        toAddress = solMatch[0];
        network = "solana";
      }
    }

    if (amountMatch && toAddress) {
      return {
        type: "SEND",
        network,
        amount: parseFloat(amountMatch[1]),
        ticker: amountMatch[2].toUpperCase(),
        to: toAddress,
        description: `Transfer ${amountMatch[1]} ${amountMatch[2].toUpperCase()} to ${toAddress}`
      };
    }
  }

  // Fallback - Ambiguous / Instruction
  return {
    type: "UNKNOWN",
    prompt: prompt,
    description: "Ambiguous instruction. Ask for clarification."
  };
}

module.exports = { parsePrompt };
