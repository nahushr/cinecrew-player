/**
 * Created by yuanzhou.xu on 2018/5/14.
 */
import React, { Component } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import VLCPlayer from '../VLCPlayer';
import PropTypes from 'prop-types';
import TimeLimt from './TimeLimit';
import ControlBtn from './ControlBtn';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getStatusBarHeight } from './SizeController';
const statusBarHeight = getStatusBarHeight();
let deviceHeight = Dimensions.get('window').height;
let deviceWidth = Dimensions.get('window').width;

function getLoadingState({ isLoading, loadingSuccess, isGG, type }) {
  const isIosFlash = Platform.OS === 'ios' && type === 'swf';
  return {
    showGG: isGG && (loadingSuccess || isIosFlash),
    showLoading: isLoading && !isIosFlash,
  };
}

export default class VLCPlayerView extends Component {
  static propTypes = {
    uri: PropTypes.string,
    isGG: PropTypes.bool,
    errorTitle: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.state = {
      paused: true,
      isLoading: true,
      loadingSuccess: false,
      isFull: false,
      currentTime: 0.0,
      totalTime: 0.0,
      showControls: false,
      seek: 0,
      isError: false,
    };
    this.touchTime = 0;
    this.isEnding = false;
    this.reloadSuccess = false;
  }

  static defaultProps = {
    isGG: false,
    errorTitle: 'error',
  };

  componentDidMount() {
    if (this.props.isFull) {
      this.setState({
        showControls: true,
      });
    }
  }

  componentWillUnmount() {
    this.vlcPlayer?._onStopped?.();

    if (this.bufferInterval) {
      clearInterval(this.bufferInterval);
      this.bufferInterval = null;
    }

  }

  render() {
    let {
      onEnd,
      style,
      isGG,
      type,
      isFull,
      uri,
      title,
      onLeftPress,
      closeFullScreen,
      showBack,
      showTitle,
      videoAspectRatio,
      showGoLive,
      onGoLivePress,
      onReplayPress,
      titleGolive,
      showLeftButton,
      showMiddleButton,
      showRightButton,
      errorTitle
    } = this.props;
    let { isLoading, loadingSuccess, showControls, isError } = this.state;
    const source = typeof uri === 'string' ? { uri } : uri || {};
    const { showGG, showLoading: realShowLoding } = getLoadingState({
      isLoading,
      loadingSuccess,
      isGG,
      type,
    });

    return (
      <TouchableOpacity
        activeOpacity={1}
        style={[styles.videoBtn, style]}
        onPressOut={() => {
          const currentTime = Date.now();
          if (this.touchTime === 0 || currentTime - this.touchTime >= 500) {
              this.touchTime = currentTime;
              this.setState(({ showControls }) => ({ showControls: !showControls }));
          }
        }}>
        <VLCPlayer
          ref={ref => (this.vlcPlayer = ref)}
          paused={this.state.paused}
          //seek={this.state.seek}
          style={[styles.video]}
          source={source}
          videoAspectRatio={videoAspectRatio}
          onProgress={this.onProgress.bind(this)}
          onEnd={this.onEnded.bind(this)}
          //onEnded={this.onEnded.bind(this)}
          onStopped={this.onEnded.bind(this)}
          onPlaying={this.onPlaying.bind(this)}
          onBuffering={this.onBuffering.bind(this)}
          onPaused={this.onPaused.bind(this)}
          progressUpdateInterval={250}
          onError={this._onError}
          // onError={this.onError.bind(this)}
          onLoadStart={this._onLoadStart}
        />
        {realShowLoding &&
          !isError && (
            <View style={styles.loading}>
              <ActivityIndicator size={'large'} animating={true} color="#fff" />
            </View>
          )}
        {isError && (
          <View style={[styles.loading, { backgroundColor: '#000' }]}>
            <Text style={{ color: 'red' }}>{errorTitle}</Text>
            <TouchableOpacity
              activeOpacity={1}
              onPress={this._reload}
              style={{
                width: 100,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 10,
              }}>
              <Icon name={'reload'} size={45} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.topView}>
          <View style={styles.backBtn}>
            {showBack && (
              <TouchableOpacity
                onPress={() => {
                  if (isFull) {
                    closeFullScreen?.();
                  } else {
                    onLeftPress?.();
                  }
                }}
                style={styles.btn}
                activeOpacity={0.8}>
                <Icon name={'chevron-left'} size={30} color="#fff" />
              </TouchableOpacity>
            )}
            <View style={{ justifyContent: 'center', flex: 1, marginRight: 10 }}>
              {showTitle &&
                showControls && (
                  <Text style={{ color: '#fff', fontSize: 16 }} numberOfLines={1}>
                    {title}
                  </Text>
                )}
            </View>
            {showGG && (
              <View style={styles.GG}>
                <TimeLimt
                  onEnd={() => {
                    onEnd?.();
                  }}
                //maxTime={Math.ceil(this.state.totalTime)}
                />
              </View>
            )}
          </View>
        </View>
        <View style={[styles.bottomView]}>
          {showControls && (
            <ControlBtn
              //style={isFull?{width:deviceHeight}:{}}
              showSlider={!isGG}
              showGG={showGG}
              onEnd={onEnd}
              title={title}
              onLeftPress={onLeftPress}
              paused={this.state.paused}
              isFull={isFull}
              currentTime={this.state.currentTime}
              totalTime={this.state.totalTime}
              onPausedPress={this._play}
              onFullPress={this._toFullScreen}
              onValueChange={value => {
                this.changingSlider = true;
                this.setState({
                  currentTime: value,
                });
              }}
              onSlidingComplete={value => {
                this.changingSlider = false;
                if (Platform.OS === 'ios') {
                  this.vlcPlayer.seek(Number((value / this.state.totalTime).toFixed(17)));
                } else {
                  this.vlcPlayer.seek(value);
                }
              }}
              showGoLive={showGoLive}
              onGoLivePress={onGoLivePress}
              onReplayPress={onReplayPress}
              titleGolive={titleGolive}
              showLeftButton={showLeftButton}
              showMiddleButton={showMiddleButton}
              showRightButton={showRightButton}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  }

  /**
   * 视屏播放
   * @param event
   */
  onPlaying(event) {
    this.isEnding = false;
    // if (this.state.paused) {
    //   this.setState({ paused: false });
    // }
  }

  /**
   * 视屏停止
   * @param event
   */
  onPaused(event) {
    // if (!this.state.paused) {
    //   this.setState({ paused: true, showControls: true });
    // } else {
    //   this.setState({ showControls: true });
    // }
  }

  /**
   * 视屏缓冲
   * @param event
   */
  onBuffering(event) {
    this.setState({
      isLoading: true,
      isError: false,
    });
    this.bufferTime = Date.now();
    if (!this.bufferInterval) {
      this.bufferInterval = setInterval(this.bufferIntervalFunction, 250);
    }
  }

  bufferIntervalFunction = () => {
    const currentTime = Date.now();
    let diffTime = currentTime - this.bufferTime;
    if (diffTime > 1000) {
      clearInterval(this.bufferInterval);
      this.setState({
        paused: true,
      }, () => {
        this.setState({
          paused: false,
          isLoading: false,
        });
      });
      this.bufferInterval = null;
    }
  };

  _onError = e => {
    // [bavv add start]
    let { onVLCError, onError } = this.props;
    onVLCError?.();
    // [bavv add end]
    this.reloadSuccess = false;
    this.setState({
      isError: true,
    });
    onError?.();
  };

  _onLoadStart = e => {
    let { isError } = this.state;
    if (isError) {
      this.reloadSuccess = true;
      let { currentTime, totalTime } = this.state;
      if (Platform.OS === 'ios') {
      this.vlcPlayer?.seek?.(Number((currentTime / totalTime).toFixed(17)));
    } else {
      this.vlcPlayer?.seek?.(currentTime);
      }
      this.setState({
        paused: true,
        isError: false,
      }, () => {
        this.setState({
          paused: false,
        });
      })
    } else {
      this.vlcPlayer?.seek?.(0);
      this.setState({
        isLoading: true,
        isError: false,
        loadingSuccess: false,
        paused: true,
        currentTime: 0.0,
        totalTime: 0.0,
      }, () => {
        this.setState({
          paused: false,
        });
      })
    }
  };

  _reload = () => {
    if (!this.reloadSuccess) {
      this.vlcPlayer?.resume?.(false);
    }
  };

  /**
   * 视屏进度变化
   * @param event
   */
  onProgress(event) {
    /* console.log(
     'position=' +
     event.position +
     ',currentTime=' +
     event.currentTime +
     ',remainingTime=' +
     event.remainingTime,
     );*/
    const currentTime = event.currentTime;
    const loadingSuccess = currentTime > 0 || this.state.currentTime > 0;
    const hasProgress = currentTime !== 0 && currentTime !== this.state.currentTime * 1000;
    if (!this.changingSlider && hasProgress) {
      this.setState({
        loadingSuccess,
        isLoading: false,
        isError: false,
        progress: event.position,
        currentTime: event.currentTime / 1000,
        totalTime: event.duration / 1000,
      });
    }
  }

  /**
   * 视屏播放结束
   * @param event
   */
  onEnded(event) {
    let { currentTime, totalTime } = this.state;
    // [bavv add start]
    let { onVLCEnded, onEnd, isGG } = this.props;
    onVLCEnded?.();
    // [bavv add end]
    if (((currentTime + 5) >= totalTime && totalTime > 0) || isGG) {
      this.setState(
        {
          paused: true,
          //showControls: true,
        },
        () => {
          if (!this.isEnding) {
            onEnd?.();
            if (!isGG) {
              this.vlcPlayer?.resume?.(false);
            }
            this.isEnding = true;
          }
        },
      );
    } else {
      /* console.log('onEnded   error:'+this.props.uri);
       this.vlcPlayer.resume && this.vlcPlayer.resume(false);*/
      /*this.setState({
        paused: true,
      },()=>{
        console.log('onEnded   error:'+this.props.uri);
        this.reloadSuccess = false;
        this.setState({
          isError: true,
        });
      });*/
    }
  }

  /**
   * 全屏
   * @private
   */
  _toFullScreen = () => {
    let { startFullScreen, closeFullScreen, isFull } = this.props;
    if (isFull) {
      closeFullScreen?.();
    } else {
      startFullScreen?.();
    }
  };

  /**
   * 播放/停止
   * @private
   */
  _play = () => {
    this.setState(({ paused }) => ({ paused: !paused }));
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  videoBtn: {
    flex: 1,
  },
  video: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    width: '100%',
  },
  loading: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 0,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  GG: {
    backgroundColor: 'rgba(255,255,255,1)',
    height: 30,
    marginRight: 10,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topView: {
    top: Platform.OS === 'ios' ? statusBarHeight : 0,
    left: 0,
    height: 45,
    position: 'absolute',
    width: '100%',
    //backgroundColor: 'red'
  },
  bottomView: {
    bottom: 0,
    left: 0,
    height: 50,
    position: 'absolute',
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0)',
  },
  backBtn: {
    height: 45,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    marginLeft: 10,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    height: 40,
    borderRadius: 20,
    width: 40,
    paddingTop: 3,
  },
});
