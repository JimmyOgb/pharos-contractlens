import subprocess
import os

SEGMENTS = [
    ("seg1.mp3", "Welcome to Pharos ContractLens, an autonomous agent-native due-diligence platform for Pharos Pacific Mainnet."),
    ("seg2.mp3", "Before interacting with any contract, ContractLens gathers live evidence using the official Pharos Chain MCP, Developer Docs MCP, and the Skill Engine."),
    ("seg3.mp3", "First, we select MultiCall3, a canonical utility. The agent queries bytecode, inspects storage, and matches official GitBook documentation, returning an approved PASS state with complete block provenance."),
    ("seg4.mp3", "Next, we inspect Faroo Liquid Staking. The agent detects an EIP-1967 proxy implementation and centralized admin ownership, assigning a REVIEW state with explicit warnings."),
    ("seg5.mp3", "Finally, testing an uninitialized address reveals zero deployed bytecode. The agent enforces a fail-closed BLOCK decision to protect users from interacting with inactive accounts."),
    ("seg6.mp3", "ContractLens operates strictly read-only with zero private key custody. Explore the live application on Vercel and review the source code on GitHub.")
]

demo_dir = "skills/pharos-contractlens/demo"

for filename, text in SEGMENTS:
    out_path = os.path.join(demo_dir, filename)
    cmd = ["edge-tts", "--text", text, "--voice", "en-US-ChristopherNeural", "--write-media", out_path]
    print(f"Generating {filename}...")
    subprocess.run(cmd, check=True)

# Create concat list with silence pauses
concat_file = os.path.join(demo_dir, "concat.txt")
with open(concat_file, "w") as f:
    for filename, _ in SEGMENTS:
        f.write(f"file '{filename}'\n")

# Concatenate all into master voiceover.mp3
master_mp3 = os.path.join(demo_dir, "voiceover.mp3")
ffmpeg_cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_file, "-c", "copy", master_mp3]
print("Concatenating into voiceover.mp3...")
subprocess.run(ffmpeg_cmd, check=True)
print("Complete master voiceover generated:", master_mp3)
