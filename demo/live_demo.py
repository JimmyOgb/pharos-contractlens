import asyncio
import os
import subprocess
from playwright.async_api import async_playwright

PROD_URL = "https://pharos-contractlens.vercel.app"
DEMO_DIR = os.path.abspath("skills/pharos-contractlens/demo")
RAW_VIDEO_DIR = os.path.join(DEMO_DIR, "raw_video")
FINAL_MP4 = os.path.join(DEMO_DIR, "Pharos_ContractLens_Walkthrough.mp4")
VOICEOVER_MP3 = os.path.join(DEMO_DIR, "voiceover.mp3")

CURSOR_JS = """
() => {
  if (document.getElementById('demo-cursor')) return;
  const cursor = document.createElement('div');
  cursor.id = 'demo-cursor';
  Object.assign(cursor.style, {
    position: 'fixed', top: '0px', left: '0px',
    width: '20px', height: '20px',
    background: 'rgba(0, 229, 163, 0.85)',
    border: '2px solid white', borderRadius: '50%',
    boxShadow: '0 0 14px rgba(0, 229, 163, 0.8)',
    pointerEvents: 'none', zIndex: '999999',
    transition: 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
    transform: 'translate(-50%, -50%)'
  });
  document.body.appendChild(cursor);

  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
  document.addEventListener('mousedown', e => {
    cursor.style.transform = 'translate(-50%, -50%) scale(0.6)';
    const ripple = document.createElement('div');
    Object.assign(ripple.style, {
      position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px',
      width: '12px', height: '12px', borderRadius: '50%',
      border: '2px solid rgba(0, 229, 163, 0.9)',
      transform: 'translate(-50%, -50%) scale(1)',
      opacity: '1', pointerEvents: 'none', zIndex: '999998',
      transition: 'all 0.45s ease-out'
    });
    document.body.appendChild(ripple);
    requestAnimationFrame(() => {
      ripple.style.transform = 'translate(-50%, -50%) scale(4)';
      ripple.style.opacity = '0';
    });
    setTimeout(() => ripple.remove(), 450);
  });
  document.addEventListener('mouseup', () => {
    cursor.style.transform = 'translate(-50%, -50%) scale(1)';
  });
}
"""

async def smooth_click(page, selector: str, pause_after: float = 1.2):
    loc = page.locator(selector).first
    await loc.wait_for(state="visible", timeout=15000)
    await loc.scroll_into_view_if_needed()
    box = await loc.bounding_box()
    if box:
        target_x = box["x"] + box["width"] / 2
        target_y = box["y"] + box["height"] / 2
        await page.mouse.move(target_x, target_y, steps=25)
        await asyncio.sleep(0.2)
        await page.mouse.click(target_x, target_y)
    else:
        await loc.click()
    await asyncio.sleep(pause_after)

async def record():
    os.makedirs(RAW_VIDEO_DIR, exist_ok=True)
    for f in os.listdir(RAW_VIDEO_DIR):
        try:
            os.remove(os.path.join(RAW_VIDEO_DIR, f))
        except:
            pass

    print("[DEMO] Launching Playwright browser recording session...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1920,1080"
            ]
        )
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=RAW_VIDEO_DIR,
            record_video_size={"width": 1920, "height": 1080}
        )

        page = await context.new_page()

        # Scene 1: Open Application
        print("[DEMO] Navigating to", PROD_URL)
        await page.goto(PROD_URL, wait_until="networkidle", timeout=30000)
        await page.evaluate(CURSOR_JS)
        await asyncio.sleep(2.0)

        # Smooth mouse move around hero & tooling badges
        await page.mouse.move(960, 200, steps=20)
        await asyncio.sleep(1.0)
        await page.mouse.move(300, 500, steps=20)
        await asyncio.sleep(1.0)

        # Scene 2: MultiCall3 Preset & Due-Diligence
        print("[DEMO] Selecting Preset 0: MultiCall3")
        await smooth_click(page, ".preset-chip:nth-child(1)", pause_after=1.5)
        await smooth_click(page, "#btnAnalyze", pause_after=2.0)

        # Wait for results panel to be active
        print("[DEMO] Waiting for MultiCall3 analysis results...")
        await page.locator("#stateResults.active").wait_for(state="visible", timeout=35000)
        await asyncio.sleep(3.0)

        # Inspect Findings
        await page.mouse.move(900, 400, steps=25)
        await asyncio.sleep(1.5)

        # Click Agent Tool Traces Tab
        print("[DEMO] Clicking Agent Tool Traces Tab...")
        await smooth_click(page, "button[data-tab='tabTraces']", pause_after=2.5)
        await page.mouse.move(900, 600, steps=20)
        await asyncio.sleep(2.0)

        # Click Cryptographic Provenance Tab
        print("[DEMO] Clicking Cryptographic Provenance Tab...")
        await smooth_click(page, "button[data-tab='tabProvenance']", pause_after=2.5)
        await page.mouse.move(900, 600, steps=20)
        await asyncio.sleep(2.0)

        # Scene 3: Unsigned Transaction Review
        print("[DEMO] Clicking Unsigned Tx Review Tab...")
        await smooth_click(page, "button[data-tab='tabTx']", pause_after=3.0)
        await page.mouse.move(900, 500, steps=25)
        await asyncio.sleep(3.0)

        # Scene 4: Faroo Liquid Staking Proxy (REVIEW)
        print("[DEMO] Selecting Preset 1: Faroo Proxy")
        await smooth_click(page, "button[data-tab='tabFindings']", pause_after=1.0)
        await smooth_click(page, ".preset-chip:nth-child(2)", pause_after=1.5)
        await smooth_click(page, "#btnAnalyze", pause_after=2.0)

        print("[DEMO] Waiting for Faroo analysis results...")
        await page.locator("#stateResults.active").wait_for(state="visible", timeout=55000)
        await asyncio.sleep(4.0)

        # Scene 5: Uninitialized Address (BLOCK)
        print("[DEMO] Selecting Preset 5: Uninitialized Address")
        await smooth_click(page, ".preset-chip:nth-child(5)", pause_after=1.5)
        await smooth_click(page, "#btnAnalyze", pause_after=2.0)

        print("[DEMO] Waiting for Uninitialized analysis results...")
        await page.locator("#stateResults.active").wait_for(state="visible", timeout=55000)
        await asyncio.sleep(4.0)

        # Final pause
        await asyncio.sleep(2.0)
        print("[DEMO] Closing browser context and saving raw stream...")
        await context.close()
        await browser.close()

    # Find the recorded webm file
    webm_files = [f for f in os.listdir(RAW_VIDEO_DIR) if f.endswith(".webm")]
    if not webm_files:
        raise RuntimeError("No recorded webm video found in " + RAW_VIDEO_DIR)

    raw_webm = os.path.join(RAW_VIDEO_DIR, webm_files[0])
    print("[DEMO] Raw webm captured:", raw_webm)

    # Merge audio and video via FFmpeg
    print("[DEMO] Muxing video and synchronized voiceover with FFmpeg...")
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-i", raw_webm,
        "-i", VOICEOVER_MP3,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-r", "30",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        FINAL_MP4
    ]
    subprocess.run(ffmpeg_cmd, check=True)
    print("[DEMO] Final production MP4 generated successfully:", FINAL_MP4)

if __name__ == "__main__":
    asyncio.run(record())
