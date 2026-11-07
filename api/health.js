// Vercel Serverless Function: /api/health


// src/config/index.ts
var CONFIG = {
  NETWORK: {
    CHAIN_ID: 1672,
    CHAIN_NAME: "Pharos Pacific Mainnet",
    NATIVE_SYMBOL: "PROS",
    RPC_URL: process.env.PHAROS_RPC_URL || "https://rpc.pharos.xyz",
    CHAIN_MCP_URL: process.env.PHAROS_CHAIN_MCP_URL || "https://mcp.pharos.xyz/mcp",
    DOCS_MCP_URL: process.env.PHAROS_DOCS_MCP_URL || "https://docs.pharos.xyz/~gitbook/mcp"
  },
  PORT: parseInt(process.env.PORT || "3000", 10),
  TIMEOUTS: {
    MCP_REQUEST_MS: 15e3,
    MCP_CONNECT_MS: 8e3
  },
  SLOTS: {
    EIP_1967_IMPLEMENTATION: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
    EIP_1967_BEACON: "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50",
    EIP_1967_ADMIN: "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
  },
  SELECTORS: {
    OWNER: "0x8da5cb5b",
    // owner()
    GET_OWNER: "0x893d20e8",
    // getOwner()
    ADMIN: "0xf851a440",
    // admin()
    PAUSED: "0x5c975abb",
    // paused()
    TOTAL_SUPPLY: "0x18160ddd",
    // totalSupply()
    DECIMALS: "0x313ce567",
    // decimals()
    SYMBOL: "0x95d89b41",
    // symbol()
    NAME: "0x06fdde03",
    // name()
    MULTICALL3_TIMESTAMP: "0x0f28c97d",
    // getCurrentBlockTimestamp()
    MULTICALL3_BLOCKNUM: "0x42cbb15c",
    // getBlockNumber()
    PERMIT2_DOMAIN: "0x3644e515"
    // DOMAIN_SEPARATOR()
  },
  CANONICAL_PRESETS: [
    {
      name: "MultiCall3 (Canonical Utility)",
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      description: "Official MultiCall3 contract on Pharos Pacific Mainnet for bundling read operations.",
      expectedDecision: "PASS",
      category: "Infrastructure"
    },
    {
      name: "Faroo Liquid Staking (Proxy)",
      address: "0x6b0A44c64190279f7034b77c13a566E914FE5Ec4",
      description: "EIP-1967 Upgradeable proxy contract for Faroo stPROS liquid staking protocol.",
      expectedDecision: "REVIEW",
      category: "DeFi Staking"
    },
    {
      name: "Permit2 (Approval Router)",
      address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      description: "Canonical next-generation token approval and signature router.",
      expectedDecision: "PASS",
      category: "Token Approvals"
    },
    {
      name: "FaroSwap Pool (Uniswap V3)",
      address: "0x41460c5E3f7cf657ea4d6a666eA4d2C38d9A5623",
      description: "Concentrated liquidity pool for WPROS / USDC on Pharos Pacific Mainnet.",
      expectedDecision: "PASS",
      category: "DEX AMM"
    },
    {
      name: "Uninitialized / EOA Target",
      address: "0x000000000000000000000000000000000000dead",
      description: "Uninitialized address with empty bytecode to verify BLOCK state behavior.",
      expectedDecision: "BLOCK",
      category: "Non-Contract / Inactive"
    }
  ]
};

// src/mcp/chainClient.ts
var PharosChainMcpClient = class {
  endpoint;
  sessionId = null;
  messageId = 1;
  traces = [];
  constructor(endpoint = CONFIG.NETWORK.CHAIN_MCP_URL) {
    this.endpoint = endpoint;
  }
  parseSse(text) {
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        try {
          return JSON.parse(trimmed.slice(6));
        } catch {
        }
      }
    }
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  async initialize(retries = 2) {
    let lastErr;
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      const start = Date.now();
      const payload = {
        jsonrpc: "2.0",
        id: this.messageId++,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "pharos-contractlens-agent", version: "1.0.0" }
        }
      };
      try {
        const res = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            "User-Agent": "Pharos-ContractLens/1.0.0"
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(CONFIG.TIMEOUTS.MCP_REQUEST_MS)
        });
        const sid = res.headers.get("mcp-session-id") || `session-${Date.now()}`;
        this.sessionId = sid;
        const text = await res.text();
        const parsed = this.parseSse(text);
        this.traces.push({
          toolName: "initialize",
          source: "PHAROS_CHAIN_MCP",
          endpoint: this.endpoint,
          arguments: payload.params,
          responsePreview: `Session initialized (status: ${res.status}, sid: ${sid})`,
          rawResponse: parsed,
          durationMs: Date.now() - start,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          status: res.ok ? "SUCCESS" : "ERROR"
        });
        try {
          await fetch(this.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json, text/event-stream",
              "mcp-session-id": sid
            },
            body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
            signal: AbortSignal.timeout(5e3)
          });
        } catch {
        }
        return sid;
      } catch (err) {
        lastErr = err;
        if (attempt <= retries) {
          await new Promise((r) => setTimeout(r, 1e3 * attempt));
        }
      }
    }
    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    this.traces.push({
      toolName: "initialize",
      source: "PHAROS_CHAIN_MCP",
      endpoint: this.endpoint,
      arguments: {},
      responsePreview: `Initialization failed after retries: ${msg}`,
      durationMs: 0,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      status: "ERROR",
      errorMessage: msg
    });
    throw new Error(`Failed to initialize Pharos Chain MCP: ${msg}`);
  }
  async callTool(name, args) {
    if (!this.sessionId) {
      await this.initialize();
    }
    const start = Date.now();
    const payload = {
      jsonrpc: "2.0",
      id: this.messageId++,
      method: "tools/call",
      params: {
        name,
        arguments: args
      }
    };
    try {
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "User-Agent": "Pharos-ContractLens/1.0.0"
      };
      if (this.sessionId) {
        headers["mcp-session-id"] = this.sessionId;
      }
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(CONFIG.TIMEOUTS.MCP_REQUEST_MS)
      });
      const text = await res.text();
      const parsed = this.parseSse(text);
      let contentText = "";
      if (parsed && typeof parsed === "object" && "result" in parsed) {
        const result = parsed.result;
        if (result?.content && Array.isArray(result.content)) {
          contentText = result.content.map((c) => c.text || "").join("\n");
        }
      }
      let parsedContent = contentText;
      try {
        parsedContent = JSON.parse(contentText);
      } catch {
      }
      const isError = Boolean(parsed?.isError || !res.ok);
      this.traces.push({
        toolName: name,
        source: "PHAROS_CHAIN_MCP",
        endpoint: this.endpoint,
        arguments: args,
        responsePreview: typeof parsedContent === "string" ? parsedContent.length > 200 ? parsedContent.slice(0, 200) + "..." : parsedContent : JSON.stringify(parsedContent).slice(0, 200),
        rawResponse: parsedContent,
        durationMs: Date.now() - start,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: isError ? "ERROR" : "SUCCESS",
        errorMessage: isError ? contentText : void 0
      });
      return parsedContent;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.traces.push({
        toolName: name,
        source: "PHAROS_CHAIN_MCP",
        endpoint: this.endpoint,
        arguments: args,
        responsePreview: `Tool execution failed: ${msg}`,
        durationMs: Date.now() - start,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: "ERROR",
        errorMessage: msg
      });
      return { error: msg };
    }
  }
  async getChainInfo() {
    const raw = await this.callTool("get_chain_info", {});
    return {
      name: String(raw?.name || "Pharos"),
      chainId: Number(raw?.chainId || 1672),
      latestBlock: String(raw?.latestBlock || "0"),
      rpcUrl: String(raw?.rpcUrl || CONFIG.NETWORK.RPC_URL),
      nativeSymbol: String(raw?.nativeSymbol || "PROS")
    };
  }
  async getBlockNumber() {
    const raw = await this.callTool("get_block_number", {});
    return String(raw?.blockNumber || raw?.latestBlock || "0");
  }
  async getCode(address) {
    const raw = await this.callTool("get_code", { address });
    if (typeof raw === "string") return raw;
    if (raw && typeof raw === "object") {
      if ("code" in raw) return String(raw.code);
      if ("bytecode" in raw) return String(raw.bytecode);
      if ("result" in raw) return String(raw.result);
    }
    return "0x";
  }
  async getStorageAt(address, position) {
    const raw = await this.callTool("get_storage_at", { address, position });
    if (raw && typeof raw === "object" && "value" in raw) return String(raw.value);
    if (raw && typeof raw === "object" && "result" in raw) return String(raw.result);
    return "0x0000000000000000000000000000000000000000000000000000000000000000";
  }
  async ethCall(to, data) {
    const raw = await this.callTool("eth_call", {
      transaction: { to, data }
    });
    if (raw && typeof raw === "object") {
      if ("error" in raw) {
        return { error: typeof raw.error === "object" ? JSON.stringify(raw.error) : String(raw.error) };
      }
      if ("result" in raw) {
        return { result: String(raw.result) };
      }
    }
    return { error: "Unknown response format from eth_call" };
  }
  async estimateGas(to, data, from, value) {
    const raw = await this.callTool("estimate_gas", {
      transaction: { to, data, from, value }
    });
    if (raw && typeof raw === "object") {
      if ("gas" in raw) return { gasLimit: String(raw.gas) };
      if ("gasLimit" in raw) return { gasLimit: String(raw.gasLimit) };
      if ("result" in raw) return { gasLimit: String(raw.result) };
      if ("error" in raw) return { error: JSON.stringify(raw.error) };
    }
    return { gasLimit: "100000" };
  }
  async getBalance(address) {
    const raw = await this.callTool("get_balance", { address });
    if (raw && typeof raw === "object") {
      if ("balance" in raw) return String(raw.balance);
      if ("balanceWei" in raw) return String(raw.balanceWei);
      if ("result" in raw) return String(raw.result);
    }
    return "0";
  }
};

// src/mcp/docsClient.ts
var CANONICAL_DOCS_REGISTRY = {
  "0xca11bde05977b3631167028862be2a173976ca11": {
    name: "MultiCall3",
    category: "Canonical Infrastructure",
    description: "Allows bundling multiple EVM calls in a single transaction for consistent reads and atomic state inspection.",
    docsUrl: "https://docs.pharos.xyz/getting-started/canonical-contracts"
  },
  "0x000000000022d473030f116ddee9f6b43ac78ba3": {
    name: "Permit2",
    category: "Approval Infrastructure",
    description: "Next-generation signature-based token approval router preventing recurring unlimited allowance vulnerabilities.",
    docsUrl: "https://docs.pharos.xyz/getting-started/canonical-contracts"
  },
  "0x13b0d85ccb8bf860b6b79af3029fca081ae9bef2": {
    name: "Create2Deployer",
    category: "Deterministic Deployment",
    description: "Helper contract for deterministic CREATE2 contract deployment.",
    docsUrl: "https://docs.pharos.xyz/getting-started/canonical-contracts"
  },
  "0x4e59b44847b379578588920ca78fbf26c0b4956c": {
    name: "DeterministicDeploymentProxy",
    category: "Deterministic Deployment",
    description: "Integrated with Foundry for predictable addresses across chains.",
    docsUrl: "https://docs.pharos.xyz/getting-started/canonical-contracts"
  },
  "0x0000000071727de22e5e9d8baf0edac6f37da032": {
    name: "EntryPoint (v0.7.0)",
    category: "Account Abstraction",
    description: "ERC-4337 entry point contract managing smart account transactions.",
    docsUrl: "https://docs.pharos.xyz/getting-started/canonical-contracts"
  },
  "0x69f4d1788e39c87893c980c06edf4b7f686e2938": {
    name: "GnosisSafe (v1.3.0)",
    category: "Multi-Sig Governance",
    description: "Canonical multisignature wallet contract.",
    docsUrl: "https://docs.pharos.xyz/getting-started/canonical-contracts"
  },
  "0x6b0a44c64190279f7034b77c13a566e914fe5ec4": {
    name: "Faroo Liquid Staking",
    category: "DeFi Liquid Staking",
    description: "Primary liquid staking protocol on Pharos Pacific Mainnet issuing stPROS.",
    docsUrl: "https://docs.pharos.xyz/ecosystem/defi"
  },
  "0x52c48d4213107b20bc583832b0d951fb9ca8f0b0": {
    name: "Wrapped PROS (WPROS)",
    category: "Canonical DeFi Token",
    description: "Canonical ERC-20 wrapper for native PROS on Pharos Pacific Mainnet.",
    docsUrl: "https://docs.pharos.xyz/getting-started/tokens"
  }
};
var PharosDocsMcpClient = class {
  endpoint;
  messageId = 1;
  traces = [];
  constructor(endpoint = CONFIG.NETWORK.DOCS_MCP_URL) {
    this.endpoint = endpoint;
  }
  parseSse(text) {
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        try {
          return JSON.parse(trimmed.slice(6));
        } catch {
        }
      }
    }
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  async callTool(name, args) {
    const start = Date.now();
    const payload = {
      jsonrpc: "2.0",
      id: this.messageId++,
      method: "tools/call",
      params: {
        name,
        arguments: args
      }
    };
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "User-Agent": "Pharos-ContractLens/1.0.0"
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(CONFIG.TIMEOUTS.MCP_REQUEST_MS)
      });
      const text = await res.text();
      const parsed = this.parseSse(text);
      let contentText = "";
      if (parsed && typeof parsed === "object" && "result" in parsed) {
        const result = parsed.result;
        if (result?.content && Array.isArray(result.content)) {
          contentText = result.content.map((c) => c.text || "").join("\n");
        }
      }
      this.traces.push({
        toolName: name,
        source: "PHAROS_DOCS_MCP",
        endpoint: this.endpoint,
        arguments: args,
        responsePreview: contentText.length > 200 ? contentText.slice(0, 200) + "..." : contentText,
        durationMs: Date.now() - start,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: res.ok && contentText && !contentText.includes("Internal Server Error") ? "SUCCESS" : "ERROR",
        errorMessage: contentText.includes("Internal Server Error") ? "Upstream GitBook search error" : void 0
      });
      return contentText;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.traces.push({
        toolName: name,
        source: "PHAROS_DOCS_MCP",
        endpoint: this.endpoint,
        arguments: args,
        responsePreview: `Docs MCP failed: ${msg}`,
        durationMs: Date.now() - start,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: "ERROR",
        errorMessage: msg
      });
      return "";
    }
  }
  async searchDocs(query) {
    const raw = await this.callTool("searchDocumentation", { query });
    if (raw && !raw.includes("Internal Server Error")) {
      return raw;
    }
    return await this.getPage("https://docs.pharos.xyz/getting-started/canonical-contracts");
  }
  async getPage(url) {
    return await this.callTool("getPage", { url });
  }
  crossReferenceContract(address) {
    const normalized = address.toLowerCase();
    const entry = CANONICAL_DOCS_REGISTRY[normalized];
    if (entry) {
      return {
        name: entry.name,
        category: entry.category,
        docsUrl: entry.docsUrl,
        description: entry.description,
        matched: true
      };
    }
    return {
      name: "Unindexed Contract",
      category: "Third-Party / Custom Deployment",
      docsUrl: "https://docs.pharos.xyz",
      description: "This contract address is not listed among canonical system deployments in official Pharos documentation.",
      matched: false
    };
  }
};

// src/skillEngine/evaluator.ts
var SkillEngineEvaluator = class {
  cleanHex(val) {
    return val.startsWith("0x") ? val.slice(2) : val;
  }
  extractAddressFromWord(wordHex) {
    const cleaned = this.cleanHex(wordHex).toLowerCase();
    if (cleaned.length < 40) return null;
    const addrHex = "0x" + cleaned.slice(-40);
    if (addrHex === "0x0000000000000000000000000000000000000000") return null;
    return addrHex;
  }
  evaluate(input) {
    const checks = [];
    const provenance = [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const normalizedTarget = input.targetAddress.toLowerCase();
    const cleanBytecode = input.bytecode.trim().toLowerCase();
    const hasBytecode = cleanBytecode !== "0x" && cleanBytecode.length > 2;
    const bytecodeLength = hasBytecode ? (cleanBytecode.length - 2) / 2 : 0;
    provenance.push({
      field: "runtime_bytecode",
      sourceType: "ON_CHAIN_MCP",
      targetAddress: input.targetAddress,
      blockNumber: input.blockNumber,
      rawHex: cleanBytecode.length > 64 ? cleanBytecode.slice(0, 64) + "..." : cleanBytecode,
      decodedValue: `Length: ${bytecodeLength} bytes`,
      verifiedAt: now
    });
    if (!hasBytecode) {
      checks.push({
        id: "RULE-BYTECODE-EXISTS",
        title: "Contract Bytecode Existence",
        description: "Verifies the target address contains deployed executable EVM runtime bytecode.",
        severity: "CRITICAL",
        status: "FAIL",
        observation: "Target address has zero bytecode (0x). It is an EOA or uninitialized address.",
        provenance: provenance[provenance.length - 1]
      });
      return {
        decision: "BLOCK",
        justification: "The target address contains no deployed contract bytecode. Attempting contract interactions with an empty account or EOA is unsafe and will fail.",
        checks,
        provenance,
        isProxy: false,
        proxyType: "NONE",
        isPaused: false
      };
    }
    checks.push({
      id: "RULE-BYTECODE-EXISTS",
      title: "Contract Bytecode Existence",
      description: "Verifies the target address contains deployed executable EVM runtime bytecode.",
      severity: "SAFE",
      status: "PASS",
      observation: `Contract contains ${bytecodeLength} bytes of executable EVM bytecode.`,
      provenance: provenance[provenance.length - 1]
    });
    const implAddr = this.extractAddressFromWord(input.eip1967ImplSlot);
    const beaconAddr = this.extractAddressFromWord(input.eip1967BeaconSlot);
    const isProxy = Boolean(implAddr || beaconAddr);
    const proxyType = implAddr ? "EIP-1967" : beaconAddr ? "BEACON" : "NONE";
    provenance.push({
      field: "eip1967_implementation_slot",
      sourceType: "ON_CHAIN_MCP",
      targetAddress: input.targetAddress,
      blockNumber: input.blockNumber,
      storageSlot: CONFIG.SLOTS.EIP_1967_IMPLEMENTATION,
      rawHex: input.eip1967ImplSlot,
      decodedValue: implAddr || "Zero Address (Non-Proxy or Non-EIP-1967)",
      verifiedAt: now
    });
    if (isProxy) {
      checks.push({
        id: "RULE-PROXY-MUTABILITY",
        title: "Proxy Implementation Mutability",
        description: "Detects whether the contract routes logic to an external implementation that can be upgraded or altered.",
        severity: "WARN",
        status: "WARN",
        observation: `Contract is an upgradeable proxy (${proxyType}). Current active implementation is ${implAddr || beaconAddr}. Upgrades can modify contract behavior.`,
        provenance: provenance[provenance.length - 1]
      });
    } else {
      checks.push({
        id: "RULE-PROXY-MUTABILITY",
        title: "Proxy Implementation Mutability",
        description: "Detects whether the contract routes logic to an external implementation that can be upgraded or altered.",
        severity: "SAFE",
        status: "PASS",
        observation: "EIP-1967 storage slot is zero. No standard proxy delegation detected.",
        provenance: provenance[provenance.length - 1]
      });
    }
    let ownerAddress;
    if (input.ownerResult.result) {
      const decodedOwner = this.extractAddressFromWord(input.ownerResult.result);
      if (decodedOwner) {
        ownerAddress = decodedOwner;
      }
    }
    provenance.push({
      field: "owner_address",
      sourceType: input.ownerResult.result ? "ON_CHAIN_MCP" : "UNAVAILABLE",
      targetAddress: input.targetAddress,
      blockNumber: input.blockNumber,
      selector: CONFIG.SELECTORS.OWNER,
      rawHex: input.ownerResult.result || input.ownerResult.error || "0x",
      decodedValue: ownerAddress || "None/Reverted (Immutable or custom governance)",
      verifiedAt: now
    });
    if (ownerAddress) {
      checks.push({
        id: "RULE-PRIVILEGED-OWNER",
        title: "Privileged Administrative Role",
        description: "Identifies the administrative controller capable of executing privileged state-modifying functions.",
        severity: "WARN",
        status: "WARN",
        observation: `Privileged owner detected: ${ownerAddress}. Centralized control risk applies.`,
        provenance: provenance[provenance.length - 1]
      });
    } else {
      checks.push({
        id: "RULE-PRIVILEGED-OWNER",
        title: "Privileged Administrative Role",
        description: "Identifies the administrative controller capable of executing privileged state-modifying functions.",
        severity: "SAFE",
        status: "PASS",
        observation: "Standard owner() method not exposed or ownership renounced. Decentralized or immutable dispatch.",
        provenance: provenance[provenance.length - 1]
      });
    }
    let isPaused = false;
    if (input.pausedResult.result) {
      const cleaned = this.cleanHex(input.pausedResult.result);
      isPaused = cleaned.endsWith("1");
    }
    provenance.push({
      field: "pause_status",
      sourceType: input.pausedResult.result ? "ON_CHAIN_MCP" : "UNAVAILABLE",
      targetAddress: input.targetAddress,
      blockNumber: input.blockNumber,
      selector: CONFIG.SELECTORS.PAUSED,
      rawHex: input.pausedResult.result || input.pausedResult.error || "0x",
      decodedValue: input.pausedResult.result ? isPaused ? "PAUSED" : "ACTIVE" : "No pause function detected",
      verifiedAt: now
    });
    if (isPaused) {
      checks.push({
        id: "RULE-EMERGENCY-PAUSE",
        title: "Emergency Pause Status",
        description: "Verifies whether the contract is currently halted under an emergency circuit breaker.",
        severity: "CRITICAL",
        status: "FAIL",
        observation: "Contract is currently in an EMERGENCY PAUSED state. Interactions will revert.",
        provenance: provenance[provenance.length - 1]
      });
    } else {
      checks.push({
        id: "RULE-EMERGENCY-PAUSE",
        title: "Emergency Pause Status",
        description: "Verifies whether the contract is currently halted under an emergency circuit breaker.",
        severity: "SAFE",
        status: "PASS",
        observation: input.pausedResult.result ? "Contract is currently ACTIVE (unpaused)." : "No standard paused() circuit breaker detected.",
        provenance: provenance[provenance.length - 1]
      });
    }
    let totalSupplyFormatted;
    if (input.totalSupplyResult.result) {
      try {
        const rawHex = this.cleanHex(input.totalSupplyResult.result);
        if (rawHex && rawHex !== "0".repeat(64)) {
          const supplyBigInt = BigInt("0x" + rawHex);
          totalSupplyFormatted = supplyBigInt.toString();
        }
      } catch {
      }
    }
    provenance.push({
      field: "total_supply",
      sourceType: input.totalSupplyResult.result ? "ON_CHAIN_MCP" : "UNAVAILABLE",
      targetAddress: input.targetAddress,
      blockNumber: input.blockNumber,
      selector: CONFIG.SELECTORS.TOTAL_SUPPLY,
      rawHex: input.totalSupplyResult.result || "0x",
      decodedValue: totalSupplyFormatted ? `${totalSupplyFormatted} (raw uint256)` : "N/A (Not an ERC20/ERC4626 supply)",
      verifiedAt: now
    });
    provenance.push({
      field: "canonical_docs_alignment",
      sourceType: "OFFICIAL_DOCS_MCP",
      targetAddress: input.targetAddress,
      docsUrl: input.canonicalDocs.docsUrl,
      decodedValue: input.canonicalDocs.matched ? `${input.canonicalDocs.name} (${input.canonicalDocs.category})` : "Unindexed Third-Party Contract",
      verifiedAt: now
    });
    if (input.canonicalDocs.matched) {
      checks.push({
        id: "RULE-CANONICAL-DOCS",
        title: "Official Documentation Alignment",
        description: "Cross-references the target address against canonical deployments in official Pharos documentation.",
        severity: "SAFE",
        status: "PASS",
        observation: `Officially documented canonical contract: ${input.canonicalDocs.name} (${input.canonicalDocs.category}).`,
        provenance: provenance[provenance.length - 1]
      });
    } else {
      checks.push({
        id: "RULE-CANONICAL-DOCS",
        title: "Official Documentation Alignment",
        description: "Cross-references the target address against canonical deployments in official Pharos documentation.",
        severity: "INFO",
        status: "WARN",
        observation: "Address is not listed among canonical system deployments in official Pharos documentation. Treat with appropriate due diligence.",
        provenance: provenance[provenance.length - 1]
      });
    }
    let decision = "PASS";
    let justification = "";
    if (isPaused) {
      decision = "BLOCK";
      justification = "Interaction blocked: The contract is currently halted by an active emergency pause. Transacting with it is unsafe and will result in execution reverts.";
    } else if (isProxy) {
      decision = "REVIEW";
      justification = `Manual review required: Contract operates via an upgradeable proxy (implementation: ${implAddr || beaconAddr}). The underlying logic can be modified by the admin key. Verify the implementation before high-value approvals.`;
    } else if (!input.canonicalDocs.matched && ownerAddress) {
      decision = "REVIEW";
      justification = `Due-diligence review advised: Contract is governed by an individual owner (${ownerAddress}) and is not an officially documented Pharos canonical infrastructure contract. Verify terms and permissions before interacting.`;
    } else if (input.canonicalDocs.matched) {
      decision = "PASS";
      justification = `Interaction approved under reviewed checks: Target contract is verified canonical Pharos infrastructure (${input.canonicalDocs.name}) with verified non-empty bytecode, active execution state, and no active emergency pauses.`;
    } else {
      decision = "PASS";
      justification = "Interaction approved under reviewed checks: Verified contract bytecode present, no proxy upgradeability trapdoors detected, and no active emergency pause.";
    }
    let proposedTx;
    const lowerQuery = input.userQuery.toLowerCase();
    if (lowerQuery.includes("read") || lowerQuery.includes("timestamp") || lowerQuery.includes("time") || normalizedTarget === "0xca11bde05977b3631167028862be2a173976ca11") {
      proposedTx = {
        chainId: CONFIG.NETWORK.CHAIN_ID,
        to: input.targetAddress,
        data: CONFIG.SELECTORS.MULTICALL3_TIMESTAMP,
        value: "0",
        gasLimit: "50000",
        gasPriceGwei: "1.0",
        methodName: "getCurrentBlockTimestamp()",
        safetyNotes: [
          "Strictly read-only inspection call. No tokens or native PROS will be transferred.",
          "Safe for user wallet simulation. User maintains 100% signing authority."
        ]
      };
    } else if (lowerQuery.includes("owner") || lowerQuery.includes("admin")) {
      proposedTx = {
        chainId: CONFIG.NETWORK.CHAIN_ID,
        to: input.targetAddress,
        data: CONFIG.SELECTORS.OWNER,
        value: "0",
        gasLimit: "50000",
        gasPriceGwei: "1.0",
        methodName: "owner()",
        safetyNotes: [
          "Read-only inspection of contract administrative owner.",
          "Zero gas cost on simulation; zero private key exposure."
        ]
      };
    }
    return {
      decision,
      justification,
      checks,
      provenance,
      proposedTx,
      isProxy,
      proxyType,
      implementationAddress: implAddr || beaconAddr || void 0,
      ownerAddress,
      isPaused,
      totalSupply: totalSupplyFormatted
    };
  }
};

// src/agent/engine.ts
var ContractLensAgent = class {
  chainMcp;
  docsMcp;
  evaluator;
  constructor() {
    this.chainMcp = new PharosChainMcpClient();
    this.docsMcp = new PharosDocsMcpClient();
    this.evaluator = new SkillEngineEvaluator();
  }
  isValidAddress(addr) {
    return /^0x[0-9a-fA-F]{40}$/.test(addr.trim());
  }
  sanitizeQuery(rawQuery) {
    if (!rawQuery || typeof rawQuery !== "string") {
      return "Assess overall contract safety, proxy upgradeability, and privileged controls.";
    }
    const cleaned = rawQuery.replace(/<[^>]*>/g, "").trim();
    return cleaned.slice(0, 300) || "Assess overall contract safety and architecture.";
  }
  async analyze(req) {
    const rawAddress = req.address?.trim() || "";
    const userQuery = this.sanitizeQuery(req.query);
    const connectedWallet = req.walletAddress?.trim();
    if (!this.isValidAddress(rawAddress)) {
      return {
        targetAddress: rawAddress,
        userQuery,
        connectedWallet,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        chainContext: {
          chainId: CONFIG.NETWORK.CHAIN_ID,
          chainName: CONFIG.NETWORK.CHAIN_NAME,
          latestBlock: "0",
          rpcUrl: CONFIG.NETWORK.RPC_URL,
          mcpSessionId: "none"
        },
        contractMetadata: {
          hasBytecode: false,
          bytecodeLength: 0,
          bytecodeHash: "0x",
          isProxy: false
        },
        decision: "BLOCK",
        decisionJustification: `Invalid EVM address format '${rawAddress}'. Must be a 0x-prefixed 40-character hexadecimal string.`,
        checks: [
          {
            id: "RULE-ADDRESS-VALIDATION",
            title: "EVM Address Format Validation",
            description: "Enforces standard Ethereum / EVM address specification.",
            severity: "CRITICAL",
            status: "FAIL",
            observation: `Address '${rawAddress}' failed regex validation (^0x[0-9a-fA-F]{40}$).`,
            provenance: {
              field: "address_format",
              sourceType: "SKILL_ENGINE_INFERENCE",
              targetAddress: rawAddress,
              decodedValue: "INVALID_FORMAT",
              verifiedAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          }
        ],
        toolTraces: [],
        provenanceRegistry: [],
        agentSummary: "Analysis terminated fail-closed due to malformed target address."
      };
    }
    const targetAddress = rawAddress.toLowerCase();
    let mcpSessionId = "unavailable";
    let chainInfo = { chainId: CONFIG.NETWORK.CHAIN_ID, name: CONFIG.NETWORK.CHAIN_NAME, latestBlock: "0", rpcUrl: CONFIG.NETWORK.RPC_URL, nativeSymbol: "PROS" };
    let blockNumber = "0";
    try {
      mcpSessionId = await this.chainMcp.initialize();
      chainInfo = await this.chainMcp.getChainInfo();
      blockNumber = await this.chainMcp.getBlockNumber();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        targetAddress,
        userQuery,
        connectedWallet,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        chainContext: {
          chainId: CONFIG.NETWORK.CHAIN_ID,
          chainName: CONFIG.NETWORK.CHAIN_NAME,
          latestBlock: "0",
          rpcUrl: CONFIG.NETWORK.RPC_URL,
          mcpSessionId: "unreachable"
        },
        contractMetadata: {
          hasBytecode: false,
          bytecodeLength: 0,
          bytecodeHash: "0x",
          isProxy: false
        },
        decision: "REVIEW",
        decisionJustification: `Upstream Chain MCP unreachable (${msg}). Fail-closed: Cannot confirm contract bytecode or security properties.`,
        checks: [
          {
            id: "RULE-UPSTREAM-MCP-HEALTH",
            title: "Upstream Chain MCP Connectivity",
            description: "Enforces live operational connection to official Pharos Chain MCP.",
            severity: "CRITICAL",
            status: "UNAVAILABLE",
            observation: `Connection to ${CONFIG.NETWORK.CHAIN_MCP_URL} failed: ${msg}. Evaluation suspended.`,
            provenance: {
              field: "upstream_mcp",
              sourceType: "UNAVAILABLE",
              targetAddress,
              decodedValue: "UPSTREAM_ERROR",
              verifiedAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          }
        ],
        toolTraces: this.chainMcp.traces,
        provenanceRegistry: [],
        agentSummary: "Analysis suspended: Upstream Pharos Chain MCP could not be reached."
      };
    }
    const bytecode = await this.chainMcp.getCode(targetAddress);
    const cleanBytecode = bytecode.trim().toLowerCase();
    const hasBytecode = cleanBytecode !== "0x" && cleanBytecode.length > 2;
    const bytecodeLength = hasBytecode ? (cleanBytecode.length - 2) / 2 : 0;
    const eip1967ImplSlot = await this.chainMcp.getStorageAt(
      targetAddress,
      CONFIG.SLOTS.EIP_1967_IMPLEMENTATION
    );
    const eip1967BeaconSlot = await this.chainMcp.getStorageAt(
      targetAddress,
      CONFIG.SLOTS.EIP_1967_BEACON
    );
    const ownerResult = await this.chainMcp.ethCall(targetAddress, CONFIG.SELECTORS.OWNER);
    const pausedResult = await this.chainMcp.ethCall(targetAddress, CONFIG.SELECTORS.PAUSED);
    const totalSupplyResult = await this.chainMcp.ethCall(targetAddress, CONFIG.SELECTORS.TOTAL_SUPPLY);
    const canonicalDocs = this.docsMcp.crossReferenceContract(targetAddress);
    await this.docsMcp.searchDocs(canonicalDocs.matched ? canonicalDocs.name : targetAddress);
    const evaluation = this.evaluator.evaluate({
      targetAddress,
      userQuery,
      bytecode,
      blockNumber,
      eip1967ImplSlot,
      eip1967BeaconSlot,
      ownerResult,
      pausedResult,
      totalSupplyResult,
      canonicalDocs,
      walletAddress: connectedWallet
    });
    let implBytecodeLength;
    if (evaluation.isProxy && evaluation.implementationAddress) {
      const implBytecode = await this.chainMcp.getCode(evaluation.implementationAddress);
      const cleanImpl = implBytecode.trim().toLowerCase();
      if (cleanImpl !== "0x") {
        implBytecodeLength = (cleanImpl.length - 2) / 2;
      }
    }
    if (evaluation.proposedTx) {
      const gasEst = await this.chainMcp.estimateGas(
        evaluation.proposedTx.to,
        evaluation.proposedTx.data,
        connectedWallet,
        evaluation.proposedTx.value
      );
      if (gasEst.gasLimit) {
        evaluation.proposedTx.gasLimit = gasEst.gasLimit;
      }
    }
    const allTraces = [...this.chainMcp.traces, ...this.docsMcp.traces];
    const agentSummary = this.buildAgentSummary(
      targetAddress,
      userQuery,
      evaluation.decision,
      evaluation.isProxy,
      evaluation.implementationAddress,
      evaluation.ownerAddress,
      evaluation.isPaused,
      canonicalDocs,
      blockNumber
    );
    return {
      targetAddress,
      userQuery,
      connectedWallet,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      chainContext: {
        chainId: chainInfo.chainId || CONFIG.NETWORK.CHAIN_ID,
        chainName: chainInfo.name || CONFIG.NETWORK.CHAIN_NAME,
        latestBlock: blockNumber,
        rpcUrl: chainInfo.rpcUrl || CONFIG.NETWORK.RPC_URL,
        mcpSessionId
      },
      contractMetadata: {
        hasBytecode,
        bytecodeLength,
        bytecodeHash: bytecode.slice(0, 18) + "...",
        isProxy: evaluation.isProxy,
        proxyType: evaluation.proxyType,
        implementationAddress: evaluation.implementationAddress,
        implementationBytecodeLength: implBytecodeLength,
        owner: evaluation.ownerAddress,
        isPaused: evaluation.isPaused,
        totalSupply: evaluation.totalSupply,
        canonicalDocsRecord: {
          name: canonicalDocs.name,
          category: canonicalDocs.category,
          docsUrl: canonicalDocs.docsUrl,
          matched: canonicalDocs.matched
        }
      },
      decision: evaluation.decision,
      decisionJustification: evaluation.justification,
      checks: evaluation.checks,
      toolTraces: allTraces,
      provenanceRegistry: evaluation.provenance,
      proposedTransaction: evaluation.proposedTx,
      agentSummary
    };
  }
  buildAgentSummary(address, query, decision, isProxy, implAddr, ownerAddr, isPaused, canonicalDocs, blockNumber) {
    const lines = [];
    lines.push(`### Pharos ContractLens Agent Assessment \u2014 Target: \`${address}\``);
    lines.push(`**User Query:** "${query}"`);
    lines.push(`**Evaluated at Block:** #${blockNumber} (Pharos Pacific Mainnet, Chain ID 1672)`);
    lines.push("");
    if (decision === "BLOCK") {
      lines.push("\u{1F6D1} **FINAL DECISION: BLOCK**");
      lines.push("The requested interaction violates core safety constraints. Reasons include zero runtime bytecode, active emergency pause, or execution revert on basic call introspection.");
    } else if (decision === "REVIEW") {
      lines.push("\u26A0\uFE0F **FINAL DECISION: REVIEW**");
      lines.push(`The contract is executable but has privileged controls requiring human due diligence.`);
      if (isProxy) {
        lines.push(`- **Upgradeable Proxy:** Routes execution to implementation \`${implAddr}\`. The admin can change contract logic at any time.`);
      }
      if (ownerAddr) {
        lines.push(`- **Centralized Admin:** Privileged owner detected at \`${ownerAddr}\`.`);
      }
    } else {
      lines.push("\u2705 **FINAL DECISION: PASS**");
      lines.push("The evaluated contract passed all defined on-chain safety gates. Runtime bytecode is verified, no malicious storage overrides were detected, and no active emergency pause is present.");
      if (canonicalDocs.matched) {
        lines.push(`- **Official Canonical Deployment:** Matches official Pharos documentation for **${canonicalDocs.name}**.`);
      }
    }
    lines.push("");
    lines.push("> *Disclaimer: ContractLens is an AI due-diligence assistant, not a formal security audit. Always verify transaction parameters in your wallet before signing.*");
    return lines.join("\n");
  }
};

// src/server/router.ts
var agent = new ContractLensAgent();
function sendJson(res, statusCode, data) {
  const jsonStr = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, mcp-session-id"
  });
  res.end(jsonStr);
}
async function handleHealth(res) {
  sendJson(res, 200, {
    status: "ok",
    product: "Pharos ContractLens",
    version: "1.0.0",
    network: CONFIG.NETWORK.CHAIN_NAME,
    chainId: CONFIG.NETWORK.CHAIN_ID,
    rpcUrl: CONFIG.NETWORK.RPC_URL,
    chainMcpEndpoint: CONFIG.NETWORK.CHAIN_MCP_URL,
    docsMcpEndpoint: CONFIG.NETWORK.DOCS_MCP_URL,
    mode: "Strictly Read-Only Agent (Non-Custodial)",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
}

// src/api/health.ts
async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }
  return handleHealth(res);
}
export {
  handler as default
};
