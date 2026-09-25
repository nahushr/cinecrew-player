export function buildYouTubePlayerHtml(videoId, autoPlay = true) {
  const id = String(videoId || '');
  if (!/^[\w-]{11}$/.test(id)) throw new Error('A valid YouTube video ID is required.');
  const autoplayFlag = autoPlay ? 1 : 0;
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
      window.onYouTubeIframeAPIReady=function(){
        player=new YT.Player('player',{width:'100%',height:'100%',videoId:'${id}',playerVars:{autoplay:${autoplayFlag},controls:0,playsinline:1,enablejsapi:1,rel:0,modestbranding:1,fs:0},events:{
          onReady:function(){send('ready',{});if(${autoplayFlag})player.playVideo();},
          onStateChange:function(event){state=event.data;send('state',{state:state});},
          onError:function(event){send('error',{code:event.data});}
        }});
      };
      var script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
      setInterval(function(){if(player&&state===1){send('progress',{currentTime:player.getCurrentTime(),duration:player.getDuration()});}},500);
    })();
  </script></body></html>`;
}
