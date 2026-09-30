function parseRatio(value) {
  const [width, height] = String(value || '').split(':').map(Number);
  return width > 0 && height > 0 ? width / height : null;
}

function fitRect(width, height, ratio) {
  if (!ratio || !width || !height) return { x: 0, y: 0, width, height };
  const boundsRatio = width / height;
  const frameWidth = boundsRatio > ratio ? height * ratio : width;
  const frameHeight = frameWidth / ratio;
  return { x: (width - frameWidth) / 2, y: (height - frameHeight) / 2, width: frameWidth, height: frameHeight };
}

function drawVideoFrame(context, canvas, video, aspectRatio) {
  const width = canvas.width;
  const height = canvas.height;
  context.fillStyle = '#000';
  context.fillRect(0, 0, width, height);

  const ratio = parseRatio(aspectRatio);
  const frame = fitRect(width, height, ratio);
  const sourceWidth = video.videoWidth || video.width;
  const sourceHeight = video.videoHeight || video.height;
  if (!sourceWidth || !sourceHeight) return;

  const mode = String(aspectRatio || 'FIT').toUpperCase();
  if (mode === 'STRETCH') {
    context.drawImage(video, frame.x, frame.y, frame.width, frame.height);
    return;
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const frameRatio = frame.width / frame.height;
  if (mode === 'FILL' || mode === 'FILL_SCREEN') {
    if (sourceRatio > frameRatio) {
      const croppedWidth = sourceHeight * frameRatio;
      context.drawImage(video, (sourceWidth - croppedWidth) / 2, 0, croppedWidth, sourceHeight, frame.x, frame.y, frame.width, frame.height);
    } else {
      const croppedHeight = sourceWidth / frameRatio;
      context.drawImage(video, 0, (sourceHeight - croppedHeight) / 2, sourceWidth, croppedHeight, frame.x, frame.y, frame.width, frame.height);
    }
    return;
  }

  const scale = Math.min(frame.width / sourceWidth, frame.height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(video, frame.x + (frame.width - drawWidth) / 2, frame.y + (frame.height - drawHeight) / 2, drawWidth, drawHeight);
}

function isCrossOriginCaptureError(error) {
  return error?.name === 'SecurityError' || /cross.?origin|security/i.test(error?.message || '');
}

function captureSourceStream(video, capture, ogvCanvas) {
  try {
    if (typeof capture === 'function') return capture.call(video);
    return ogvCanvas.captureStream(30);
  } catch (error) {
    if (isCrossOriginCaptureError(error)) return null;
    throw error;
  }
}

function getRecordingAudioTracks(video, sourceStream, additionalAudioStream) {
  const suppliedTracks = additionalAudioStream?.getAudioTracks?.() || [];
  if (suppliedTracks.length) return suppliedTracks;

  const ogvTracks = video.__cinecrewRecordingAudioStream?.getAudioTracks?.() || [];
  if (ogvTracks.length) return ogvTracks;
  return sourceStream.getAudioTracks();
}

function stopStreamTracks(stream) {
  stream.getTracks().forEach((track) => track.stop());
}

/** Capture the visible media frame (not player chrome) and preserve its audio tracks.
 *  Returns `null` when cross-origin restrictions prevent direct capture so the
 *  caller can fall back to screen/tab capture via `createScreenRecordingStream`.
 */
export function createVideoRecordingStream(video, playerElement, getAspectRatio, additionalAudioStream) {
  const capture = video?.captureStream || video?.webkitCaptureStream;
  if (!video || typeof MediaStream === 'undefined') {
    throw new Error('This browser does not support recording this media element.');
  }
  const ogvCanvas = typeof capture !== 'function' ? video.__cinecrewRecordingCanvas : null;

  // captureStream may not exist on every browser / element combination.
  if (typeof capture !== 'function' && typeof ogvCanvas?.captureStream !== 'function') {
    return null;
  }

  // Cross-origin media without CORS lets the caller fall back to screen capture.
  const sourceStream = captureSourceStream(video, capture, ogvCanvas);
  if (!sourceStream) return null;
  const audioTracks = getRecordingAudioTracks(video, sourceStream, additionalAudioStream);
  const drawable = ogvCanvas || video;
  const bounds = playerElement?.getBoundingClientRect?.();
  const outputWidth = Math.max(2, video.videoWidth || drawable.width || Math.round(bounds?.width || 640));
  const playerRatio = bounds?.width && bounds?.height ? bounds.width / bounds.height : 16 / 9;
  const outputHeight = Math.max(2, Math.round(outputWidth / playerRatio));
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');
  if (!context || typeof canvas.captureStream !== 'function') {
    stopStreamTracks(sourceStream);
    throw new Error('Canvas recording is not supported in this browser.');
  }

  let originClean = false;
  try {
    drawVideoFrame(context, canvas, drawable, getAspectRatio());
    context.getImageData(0, 0, 1, 1);
    originClean = true;
  } catch {
    // Cross-origin media without CORS can still be played and captured from the
    // media element, but cannot be re-rendered through a canvas.
  }

  if (!originClean) {
    stopStreamTracks(sourceStream);
    return null;
  }

  const mode = String(getAspectRatio?.() || 'FIT').toUpperCase();
  const needsCanvas = mode !== 'FIT' && mode !== 'DEFAULT';
  if (!needsCanvas) {
    const stream = new MediaStream([...sourceStream.getVideoTracks(), ...audioTracks]);
    return {
      stream,
      aspectRatioApplied: false,
      cleanup: () => {
        stopStreamTracks(sourceStream);
      },
    };
  }

  const canvasStream = canvas.captureStream(30);
  const stream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
  let frameId;
  const draw = () => {
    drawVideoFrame(context, canvas, drawable, getAspectRatio());
    frameId = requestAnimationFrame(draw);
  };
  frameId = requestAnimationFrame(draw);
  return {
    stream,
    aspectRatioApplied: true,
    cleanup: () => {
      cancelAnimationFrame(frameId);
      stopStreamTracks(canvasStream);
      stopStreamTracks(sourceStream);
    },
  };
}

/**
 * Generalised screen / tab capture that works for any source type.
 * Uses `preferCurrentTab` (Chrome 109+) to automatically select the
 * current tab, making the user experience smoother.
 */
export async function createScreenRecordingStream() {
  const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
  if (typeof mediaDevices?.getDisplayMedia !== 'function') {
    throw new TypeError('Recording requires browser tab/screen capture, which is not available in this browser.');
  }

  let stream;
  try {
    stream = await mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
      preferCurrentTab: true,
    });
  } catch (error) {
    if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
      throw new Error('Recording was cancelled. Allow tab/screen capture and choose the player tab to record.');
    }
    throw error;
  }

  const videoTracks = stream.getVideoTracks?.() || [];
  const audioTracks = stream.getAudioTracks?.() || [];
  if (!videoTracks.length || !audioTracks.length) {
    stream.getTracks?.().forEach((track) => track.stop());
    throw new Error('The selected capture has no video or tab audio. Choose a browser tab and enable Share tab audio.');
  }

  return {
    stream,
    cleanup: () => stream.getTracks?.().forEach((track) => track.stop()),
  };
}

export function getRecordingMimeType(hasAudio = true) {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = hasAudio
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || (MediaRecorder.isTypeSupported?.('video/webm') ? 'video/webm' : '');
}

export function createRecordingDownloadLink(blob, title = 'cinecrew-recording') {
  if (!blob?.size) return null;
  const safeTitle = String(title || 'cinecrew-recording').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'cinecrew-recording';
  const url = URL.createObjectURL(blob);
  return {
    url,
    filename: `${safeTitle}-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`,
  };
}

export function downloadRecording(blob, title = 'cinecrew-recording') {
  const artifact = createRecordingDownloadLink(blob, title);
  if (!artifact) return false;
  const link = document.createElement('a');
  link.href = artifact.url;
  link.download = artifact.filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(artifact.url), 60_000);
  return true;
}
