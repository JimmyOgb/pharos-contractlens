/**
 * Pharos ContractLens Frontend Application Logic
 * Pure vanilla TypeScript/ESM client, zero external bloat
 */

const PRESETS = [
  {
    name: 'MultiCall3 (Canonical Utility)',
    address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    query: 'Is this contract canonical Pharos infrastructure and is it safe to bundle calls?',
    badge: 'PASS',
    badgeClass: 'pass',
  },
  {
    name: 'Faroo Liquid Staking (Proxy)',
    address: '0x6b0A44c64190279f7034b77c13a566E914FE5Ec4',
    query: 'Is this contract an upgradeable proxy and who owns the admin key?',
    badge: 'REVIEW',
    badgeClass: 'review',
  },
  {
    name: 'Permit2 (Approval Router)',
    address: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    query: 'Check if this is the official Uniswap Permit2 contract on Pharos.',
    badge: 'PASS',
    badgeClass: 'pass',
  },
  {
    name: 'FaroSwap Pool (Uniswap V3)',
    address: '0x41460c5E3f7cf657ea4d6a666eA4d2C38d9A5623',
    query: 'Inspect this pool contract tokens, liquidity, and pause status.',
    badge: 'PASS',
    badgeClass: 'pass',
  },
  {
    name: 'Uninitialized / EOA Target',
    address: '0x000000000000000000000000000000000000dead',
    query: 'Explain what this contract does.',
    badge: 'BLOCK',
    badgeClass: 'block',
  },
];

let connectedAccount = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderPresets();
  setupEventListeners();
  checkWallet();
});

function renderPresets() {
  const container = document.getElementById('presetContainer');
  if (!container) return;

  container.innerHTML = PRESETS.map((p, idx) => `
    <div class="preset-chip" data-idx="${idx}">
      <span class="preset-name">${p.name}</span>
      <span class="preset-badge ${p.badgeClass}">${p.badge}</span>
    </div>
  `).join('');

  container.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const idx = parseInt(chip.getAttribute('data-idx') || '0', 10);
      const preset = PRESETS[idx];
      document.getElementById('inputAddress').value = preset.address;
      document.getElementById('inputQuery').value = preset.query;
    });
  });
}

function setupEventListeners() {
  // Query suggestions
  document.querySelectorAll('.btn-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-q');
      if (q) {
        document.getElementById('inputQuery').value = q;
      }
    });
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      if (targetId) {
        document.getElementById(targetId)?.classList.add('active');
      }
    });
  });

  // Form Submission
  const form = document.getElementById('analyzeForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const address = document.getElementById('inputAddress').value.trim();
    const query = document.getElementById('inputQuery').value.trim();
    if (!address) return;

    await runAnalysis(address, query);
  });

  // Wallet Connect
  document.getElementById('btnConnectWallet')?.addEventListener('click', connectWallet);
}

async function checkWallet() {
  if (typeof window.ethereum !== 'undefined') {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        setConnectedAccount(accounts[0]);
      }
    } catch {
      // ignore
    }
  }
}

async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    alert('No EVM wallet detected. Install MetaMask or open in a Web3 browser.');
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (accounts && accounts.length > 0) {
      setConnectedAccount(accounts[0]);
    }
  } catch (err) {
    console.error('Wallet connection rejected:', err);
  }
}

function setConnectedAccount(account) {
  connectedAccount = account;
  const btn = document.getElementById('walletBtnText');
  if (btn) {
    btn.textContent = `${account.slice(0, 6)}...${account.slice(-4)}`;
  }
}

function showState(state) {
  document.getElementById('stateEmpty')?.classList.toggle('active', state === 'empty');
  document.getElementById('stateLoading')?.classList.toggle('active', state === 'loading');
  document.getElementById('stateResults')?.classList.toggle('active', state === 'results');
}

async function runAnalysis(address, query) {
  showState('loading');
  const btn = document.getElementById('btnAnalyze');
  if (btn) btn.disabled = true;

  // Pipeline step simulation while network call runs
  const steps = [
    { id: 'pStep1', text: '1. Session & Chain Context' },
    { id: 'pStep2', text: '2. Bytecode & Proxy Slots' },
    { id: 'pStep3', text: '3. State & Privilege Calls' },
    { id: 'pStep4', text: '4. Canonical Docs Lookup' },
    { id: 'pStep5', text: '5. Skill Engine Decision' },
  ];

  let currentStep = 0;
  const interval = setInterval(() => {
    if (currentStep < steps.length) {
      document.querySelectorAll('.pipeline-step').forEach((s, idx) => {
        if (idx < currentStep) s.className = 'pipeline-step done';
        else if (idx === currentStep) s.className = 'pipeline-step active';
        else s.className = 'pipeline-step';
      });
      currentStep++;
    }
  }, 400);

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        query,
        walletAddress: connectedAccount || undefined,
      }),
    });

    clearInterval(interval);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server returned ${res.status}`);
    }

    const data = await res.json();
    renderAnalysisResults(data);
    showState('results');
  } catch (err) {
    clearInterval(interval);
    alert(`Analysis Failed: ${err.message}`);
    showState('empty');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderAnalysisResults(data) {
  // 1. Decision Banner
  const card = document.getElementById('decisionCard');
  const pill = document.getElementById('decisionPill');
  const headline = document.getElementById('decisionTitle');
  const text = document.getElementById('decisionJustification');

  const dec = data.decision || 'REVIEW';
  card.className = `decision-card decision-${dec.toLowerCase()}`;
  pill.textContent = dec;
  headline.textContent = dec === 'PASS'
    ? 'Interaction Approved Under Reviewed Checks'
    : dec === 'REVIEW'
    ? 'Privileged Controls Require Due-Diligence Review'
    : 'Interaction Blocked — Critical Risk Detected';

  text.textContent = data.decisionJustification || 'Evaluation completed.';

  // Counts
  document.getElementById('checksCount').textContent = (data.checks || []).length;
  document.getElementById('tracesCount').textContent = (data.toolTraces || []).length;
  document.getElementById('provCount').textContent = (data.provenanceRegistry || []).length;

  // 2. Findings Grid
  const findingsGrid = document.getElementById('findingsGrid');
  if (findingsGrid) {
    findingsGrid.innerHTML = (data.checks || []).map(c => `
      <div class="check-card">
        <div class="check-card-header">
          <span class="check-title">${c.title}</span>
          <span class="status-badge ${c.status.toLowerCase()}">${c.status}</span>
        </div>
        <div class="check-desc">${c.description}</div>
        <div class="check-observation">${c.observation}</div>
      </div>
    `).join('');
  }

  // Agent Summary
  const summaryEl = document.getElementById('agentSummaryText');
  if (summaryEl) {
    summaryEl.textContent = data.agentSummary || 'No summary available.';
  }

  // 3. Tool Traces List
  const tracesList = document.getElementById('toolTracesList');
  if (tracesList) {
    tracesList.innerHTML = (data.toolTraces || []).map(t => `
      <div class="trace-item">
        <div class="trace-header">
          <span class="trace-tool">[${t.source}] ${t.toolName}</span>
          <span class="trace-meta">${t.durationMs}ms • ${t.status}</span>
        </div>
        <div class="trace-body">Args: ${JSON.stringify(t.arguments)}\nResponse: ${t.responsePreview}</div>
      </div>
    `).join('');
  }

  // 4. Provenance Table
  const tableBody = document.getElementById('provenanceTableBody');
  if (tableBody) {
    tableBody.innerHTML = (data.provenanceRegistry || []).map(p => `
      <tr>
        <td><strong>${p.field}</strong></td>
        <td><span class="badge-tag">${p.sourceType}</span></td>
        <td>${p.blockNumber ? `#${p.blockNumber}` : '—'}</td>
        <td><code>${p.storageSlot ? p.storageSlot.slice(0, 10) + '...' : p.selector || '—'}</code></td>
        <td>${p.decodedValue || p.rawHex || '—'}</td>
      </tr>
    `).join('');
  }

  // 5. Unsigned Transaction Tab
  const txContent = document.getElementById('txContent');
  if (txContent) {
    if (data.proposedTransaction) {
      const tx = data.proposedTransaction;
      txContent.innerHTML = `
        <div class="tx-field">
          <div class="tx-label">Target Destination Contract</div>
          <div class="tx-value">${tx.to}</div>
        </div>
        <div class="tx-field">
          <div class="tx-label">Method / Function</div>
          <div class="tx-value">${tx.methodName || 'Contract Call'}</div>
        </div>
        <div class="tx-field">
          <div class="tx-label">Calldata (Hex)</div>
          <div class="tx-value">${tx.data}</div>
        </div>
        <div class="tx-field">
          <div class="tx-label">Simulated Gas Limit</div>
          <div class="tx-value">${tx.gasLimit || '50000'} units</div>
        </div>
        <div class="tx-safety-notes">
          <strong>Safety Guarantees & Non-Custodial Boundaries:</strong>
          <ul>
            ${(tx.safetyNotes || []).map(n => `<li>${n}</li>`).join('')}
          </ul>
        </div>
        <div style="margin-top: 20px;">
          <button id="btnSendToWallet" class="btn btn-secondary">
            <span>Send Unsigned Tx to Wallet for Review</span>
          </button>
        </div>
      `;

      document.getElementById('btnSendToWallet')?.addEventListener('click', async () => {
        if (!window.ethereum) {
          alert('No EVM wallet detected to receive the unsigned transaction.');
          return;
        }
        try {
          await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
              from: connectedAccount || undefined,
              to: tx.to,
              data: tx.data,
              value: '0x0',
            }],
          });
        } catch (err) {
          alert(`Wallet rejected or cancelled action: ${err.message}`);
        }
      });
    } else {
      txContent.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-dim);">
          <p>No transaction execution was requested in your question. The target contract was inspected safely in read-only mode.</p>
        </div>
      `;
    }
  }
}
