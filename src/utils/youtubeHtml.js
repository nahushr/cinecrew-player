export function buildYouTubePlayerHtml(videoId, autoPlay = true, metadata = {}) {
  const id = String(videoId || '');
  if (!/^[\w-]{11}$/.test(id)) throw new Error('A valid YouTube video ID is required.');
  const autoplayFlag = autoPlay ? 1 : 0;
  const title = JSON.stringify(String(metadata.title || 'YouTube')).replace(/</g, '\\u003c');
  const poster = JSON.stringify(String(metadata.poster || '')).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html,body,#player{width:100%;height:100%;margin:0;background:#000;overflow:hidden}body{display:flex}</style></head><body><div id="player"></div><script>
    (function(){
      var player=null, state=-1;
      function send(type, data){try{window.ReactNativeWebView.postMessage(JSON.stringify({type:type,data:data}));}catch(e){}}
      window.cinecrewPlayerCommand=function(name,value){
        if(!player)return;
        try{
          if(name==='play')player.playVideo();
          else if(name==='pause')player.pauseVideo();
          else if(name==='seek')player.seekTo(Number(value)||0,true);
          else if(name==='seekRatio'){var duration=player.getDuration();if(duration>0)player.seekTo(duration*Math.max(0,Math.min(1,Number(value)||0)),true);}
          else if(name==='mute')player.mute();
          else if(name==='unmute')player.unMute();
          else if(name==='volume')player.setVolume(Math.max(0,Math.min(100,Number(value)||0)));
          else if(name==='rate')player.setPlaybackRate(Number(value)||1);
        }catch(e){}
      };
      function updateMediaSession(state){
        if(!navigator.mediaSession)return;
        if(state===1)navigator.mediaSession.playbackState='playing';
        else if(state===2||state===0)navigator.mediaSession.playbackState='paused';
      }
      function setupMediaSession(){
        if(!navigator.mediaSession)return;
        try{
          if('MediaMetadata' in window)navigator.mediaSession.metadata=new MediaMetadata({title:${title},artist:'YouTube',artwork:${poster}?[{src:${poster},sizes:'512x512'}]:[]});
          navigator.mediaSession.setActionHandler('play',function(){player.playVideo()});
          navigator.mediaSession.setActionHandler('pause',function(){player.pauseVideo()});
          navigator.mediaSession.setActionHandler('seekbackward',function(event){player.seekTo(Math.max(0,player.getCurrentTime()-(event.seekOffset||10)),true)});
          navigator.mediaSession.setActionHandler('seekforward',function(event){player.seekTo(player.getCurrentTime()+(event.seekOffset||10),true)});
          navigator.mediaSession.setActionHandler('stop',function(){player.pauseVideo()});
        }catch(e){}
      }
      window.onYouTubeIframeAPIReady=function(){
        player=new YT.Player('player',{width:'100%',height:'100%',videoId:'${id}',playerVars:{autoplay:${autoplayFlag},controls:1,disablekb:0,playsinline:1,enablejsapi:1,rel:0,modestbranding:1,fs:0},events:{
          onReady:function(){setupMediaSession();send('ready',{});if(${autoplayFlag})player.playVideo();},
          onStateChange:function(event){state=event.data;updateMediaSession(state);send('state',{state:state});},
          onError:function(event){send('error',{code:event.data});}
        }});
      };
      var script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
      setInterval(function(){if(player&&state===1){send('progress',{currentTime:player.getCurrentTime(),duration:player.getDuration()});}},500);
    })();
  </script></body></html>`;
}
