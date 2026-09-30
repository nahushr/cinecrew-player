export async function attemptVideoPlayback(player, video, pausedRef) {
  if (pausedRef.current) return;
  try {
    await player.play();
  } catch (error) {
    if (error?.name !== 'NotAllowedError') return;
    video.muted = true;
    try {
      await player.play();
    } catch {
      // Autoplay can remain blocked until the user interacts with the page.
    }
  }
}
