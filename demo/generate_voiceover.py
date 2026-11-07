import asyncio
import edge_tts

VOICEOVER_TEXT = """
Welcome to Pharos ContractLens, an autonomous agent-native due-diligence platform for the Pharos blockchain.
Before interacting with any smart contract on Pharos Pacific Mainnet, ContractLens performs real-time verification using the official Pharos Chain MCP, the Developer Docs MCP, and the Pharos Skill Engine.
First, we select MultiCall3, a canonical utility contract on Pharos. We ask the agent to verify if this contract matches official documentation and whether it is safe for bundling calls.
We launch the autonomous due-diligence pipeline. In real time, the agent negotiates an MCP session, queries runtime bytecode, inspects proxy storage slots, and cross-references canonical GitBook records.
The evaluation completes with a PASS decision. The findings panel confirms over seven kilobytes of verified bytecode, zero proxy delegation, and a canonical documentation match. In the tool traces tab, we see genuine MCP tool calls with exact millisecond latencies. The cryptographic provenance register records the block height, selectors, and raw EVM outputs.
Next, let us evaluate an upgradeable proxy: Faroo Liquid Staking.
The agent analyzes the target on-chain, detecting the EIP-1967 implementation slot. The decision state immediately updates to REVIEW, flagging mutable proxy risk and identifying the privileged owner key.
Finally, we test an uninitialized address. The agent detects zero runtime bytecode and immediately enforces a fail-closed BLOCK decision.
ContractLens provides complete due diligence while preserving a strict non-custodial boundary: zero private key custody, strictly read-only MCP queries, and full user ownership of all transaction signing decisions.
"""

async def main():
    communicate = edge_tts.Communicate(VOICEOVER_TEXT.strip(), "en-US-ChristopherNeural")
    await communicate.save("skills/pharos-contractlens/demo/voiceover.mp3")
    print("Voiceover generated successfully.")

if __name__ == "__main__":
    asyncio.run(main())
