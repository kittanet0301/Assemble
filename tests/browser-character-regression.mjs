// Run against the real open UI using cua_repl's read-only DOM evaluation:
// tab.playwright.evaluate(probeWalking, '.character-stage .pixel-walker')
// While walking on the map, use '.map-person.is-me .pixel-walker'.
// This catches frozen frames even when the OS requests reduced CSS motion.
export async function probeWalking(selector) {
  const sprite = document.querySelector(selector);
  if (!sprite) throw new Error(`Sprite is missing: ${selector}`);
  const samples = [];
  for (let i = 0; i < 16; i++) {
    await new Promise((resolve) => setTimeout(resolve, 55));
    const player = sprite.closest('.map-person');
    samples.push({
      moving: player
        ? player.classList.contains('is-stepping')
        : sprite.classList.contains('preview-walking'),
      position: getComputedStyle(sprite).backgroundPosition,
    });
  }
  const frames = [...new Set(samples.filter((s) => s.moving).map((s) => s.position))];
  if (frames.length < 2) throw new Error('Walking avatar is frozen on one frame');
  return { frames, movingSamples: samples.filter((s) => s.moving).length };
}
