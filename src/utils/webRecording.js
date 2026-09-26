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
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
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

/** Capture the visible media frame (not player chrome) and preserve its audio tracks. */
export function createVideoRecordingStream(video, playerElement, getAspectRatio, additionalAudioStream) {
  const capture = video?.captureStream || video?.webkitCaptureStream;
  if (!video || typeof capture !== 'function' || typeof MediaStream === 'undefined') {
    throw new Error('This browser does not support recording this media element.');
  }

  let sourceStream;
  try {
    sourceStream = capture.call(video);
  } catch (error) {
    if (error?.name === 'SecurityError' || /cross.?origin|security/i.test(error?.message || '')) {
      throw new Error('The browser cannot record this cross-origin video because its source does not grant capture access. Use a local or CORS-enabled source to record it.');
    }
    throw error;
  }
  const extraAudioTracks = additionalAudioStream?.getAudioTracks?.() || [];
  const audioTracks = extraAudioTracks.length ? extraAudioTracks : sourceStream.getAudioTracks();
  const bounds = playerElement?.getBoundingClientRect?.();
  const outputWidth = Math.max(2, video.videoWidth || Math.round(bounds?.width || 640));
  const playerRatio = bounds?.width && bounds?.height ? bounds.width / bounds.height : 16 / 9;
  const outputHeight = Math.max(2, Math.round(outputWidth / playerRatio));
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');
  if (!context || typeof canvas.captureStream !== 'function') {
    sourceStream.getTracks().forEach((track) => track.stop());
    throw new Error('Canvas recording is not supported in this browser.');
  }

  let originClean = false;
  try {
    drawVideoFrame(context, canvas, video, getAspectRatio());
    context.getImageData(0, 0, 1, 1);
    originClean = true;
  } catch {
    // Cross-origin media without CORS can still be played and captured from the
    // media element, but cannot be re-rendered through a canvas.
  }

  if (!originClean) {
    return {
      stream: sourceStream,
      aspectRatioApplied: false,
      cleanup: () => sourceStream.getTracks().forEach((track) => track.stop()),
    };
  }

  const canvasStream = canvas.captureStream(30);
  const stream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
  let frameId;
  const draw = () => {
    drawVideoFrame(context, canvas, video, getAspectRatio());
    frameId = requestAnimationFrame(draw);
  };
  frameId = requestAnimationFrame(draw);
  return {
    stream,
    aspectRatioApplied: true,
    cleanup: () => {
      cancelAnimationFrame(frameId);
      canvasStream.getTracks().forEach((track) => track.stop());
      sourceStream.getTracks().forEach((track) => track.stop());
    },
  };
}

export function getRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
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
