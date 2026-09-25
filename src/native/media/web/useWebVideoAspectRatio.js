import { useState, useCallback, useEffect } from 'react';

/**
 * Hook to manage video aspect ratio scaling styles (FIT, FILL, STRETCH, CENTER, custom aspect ratios).
 */
export function useWebVideoAspectRatio(videoAspectRatio, audioOnly) {
  const [aspectFit, setAspectFit] = useState('contain');
  const [aspectRatioVal, setAspectRatioVal] = useState(undefined);

  const applyAspectRatio = useCallback((aspect) => {
    if (!aspect || aspect === 'FIT' || aspect === 'FIT_SCREEN') {
      setAspectFit('contain');
      setAspectRatioVal(undefined);
    } else if (aspect === 'FILL_SCREEN' || aspect === 'FILL') {
      setAspectFit('cover');
      setAspectRatioVal(undefined);
    } else if (aspect === 'STRETCH') {
      setAspectFit('fill');
      setAspectRatioVal(undefined);
    } else if (aspect === 'CENTER') {
      setAspectFit('none');
      setAspectRatioVal(undefined);
    } else if (typeof aspect === 'string' && aspect.includes(':')) {
      const parts = aspect.split(':');
      setAspectFit('contain');
      setAspectRatioVal(`${parts[0]}/${parts[1]}`);
    } else {
      setAspectFit('contain');
      setAspectRatioVal(undefined);
    }
  }, []);

  useEffect(() => {
    applyAspectRatio(videoAspectRatio);
  }, [videoAspectRatio, applyAspectRatio]);

  let videoStyle = {
    width: '100%',
    height: '100%',
    objectFit: aspectFit,
    backgroundColor: '#000',
  };

  if (audioOnly) {
    videoStyle = {
      width: '100%',
      height: '100%',
      objectFit: aspectFit,
      backgroundColor: '#000',
      opacity: 0,
    };
  } else if (aspectRatioVal) {
    videoStyle = {
      width: 'auto',
      height: 'auto',
      maxWidth: '100%',
      maxHeight: '100%',
      aspectRatio: aspectRatioVal,
      objectFit: 'contain',
      backgroundColor: '#000',
    };
  }

  return {
    aspectFit,
    aspectRatioVal,
    videoStyle,
    applyAspectRatio,
  };
}
