/**
 * Created by yuanzhou.xu on 2018/5/15.
 */

import React, { Component } from 'react';
import {
  StatusBar,
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Text,
  Dimensions,
} from 'react-native';

import VLCPlayerView from './VLCPlayerView';
import PropTypes from 'prop-types';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getStatusBarHeight } from './SizeController';
const statusBarHeight = getStatusBarHeight();
const _fullKey = 'commonVideo_android_fullKey';
let deviceHeight = Dimensions.get('window').height;
let deviceWidth = Dimensions.get('window').width;

function resolveVideoPresentation(props, state) {
  const currentVideoAspectRatio =
    (props.isFull ? props.fullVideoAspectRatio : props.videoAspectRatio)
    || state.currentVideoAspectRatio;
  const realShowGG = Boolean(props.showGG && props.ggUrl && !state.isEndGG);
  const showVideo = Boolean(state.currentUrl && (!props.showGG || state.isEndGG));

  return {
    currentVideoAspectRatio,
    realShowGG,
    showVideo,
    showTop: !showVideo && !realShowGG,
    type: typeof state.currentUrl === 'string' ? state.currentUrl.split('.').at(-1) || '' : '',
    ggType: typeof props.ggUrl === 'string' ? props.ggUrl.split('.').at(-1) || '' : '',
  };
}

export default class CommonVideo extends Component {
  constructor(props) {
    super(props);
    this.initialHeight = props.height || 200;

    if (props.widthCamera) {
      deviceWidth = props.widthCamera
    }
  }

  static navigationOptions = {
    header: null,
  };

  state = {
    isEndGG: false,
    isFull: false,
    currentUrl: '',
    storeUrl: '',
  };

  static defaultProps = {
    height: 250,
    showGG: false,
    ggUrl: '',
    url: '',
    showBack: false,
    showTitle: false,
  };

  static propTypes = {
    height: PropTypes.number,
    showGG: PropTypes.bool,
    ggUrl: PropTypes.string,
    url: PropTypes.string,
    /**
     * 视频播放错误
     */
    onError: PropTypes.func,
    /**
     * 视频播放结束
     */
    onEnd: PropTypes.func,

    /**
     * 广告头播放结束
     */
    onGGEnd: PropTypes.func,
    /**
     * 开启全屏
     */
    startFullScreen: PropTypes.func,
    /**
     * 关闭全屏
     */
    closeFullScreen: PropTypes.func,
    /**
     * 返回按钮点击事件
     */
    onLeftPress: PropTypes.func,
    /**
     * 标题
     */
    title: PropTypes.string,
    /**
     * 是否显示返回按钮
     */
    showBack: PropTypes.bool,
    /**
     * 是否显示标题
     */
    showTitle: PropTypes.bool,

    onGoLivePress: PropTypes.func,

    onReplayPress: PropTypes.func,
  };

  static getDerivedStateFromProps(nextProps, preState) {
    const { url } = nextProps;
    const { storeUrl } = preState;
    if (!url || url === storeUrl) return null;
    return {
      currentUrl: storeUrl === '' ? url : '',
      storeUrl: url,
      isEndGG: false,
    };
  }


  componentDidUpdate(prevProps, prevState) {
    if (this.props.url !== prevState.storeUrl && this._componentMounted) {
      this.setState({
        storeUrl: this.props.url,
        currentUrl: this.props.url
      })
    }
  }

  componentDidMount() {
    this._componentMounted = true
    StatusBar.setBarStyle("light-content");
    let { style } = this.props;

    if (style?.height != null && Number.isFinite(Number(style.height))) {
      this.initialHeight = Number(style.height);
    }
    this.setState({
      currentVideoAspectRatio: deviceWidth + ":" + this.initialHeight,
    });

    let { isFull } = this.props;
    if (isFull) {
      this._toFullScreen();
    }
  }

  componentWillUnmount() {
    this._componentMounted = false;

    let { isFull } = this.props;
    if (isFull) {
      this._closeFullScreen();
    }
  }

  _closeFullScreen = () => {
    let { closeFullScreen, BackHandle, Orientation } = this.props;
    if (this._componentMounted) {
      this.setState({ isFull: false, currentVideoAspectRatio: deviceWidth + ":" + this.initialHeight, });
    }
    BackHandle?.removeBackFunction(_fullKey);
    Orientation?.lockToPortrait?.();
    StatusBar.setHidden(false);
    //StatusBar.setTranslucent(false);
    if (this._componentMounted) closeFullScreen?.();
  };

  _toFullScreen = () => {
    let { startFullScreen, BackHandle, Orientation } = this.props;
    //StatusBar.setTranslucent(true);
    this.setState({ isFull: true, currentVideoAspectRatio: deviceHeight + ":" + deviceWidth, });
    StatusBar.setHidden(true);
    BackHandle?.addBackFunction(_fullKey, this._closeFullScreen);
    startFullScreen?.();
    Orientation?.lockToLandscape?.();
  };

  render() {
    const { ggUrl, showGG, onGGEnd, onEnd, onError, style, height, title, onLeftPress, showBack, showTitle, closeFullScreen } = this.props;
    const { isEndGG, isFull, currentUrl } = this.state;
    const { currentVideoAspectRatio, realShowGG, showVideo, showTop, type, ggType } =
      resolveVideoPresentation(this.props, this.state);
    return (
      <View
        style={[isFull ? styles.container : { height, backgroundColor: '#000' }, style]}>
        {showTop && <View style={styles.topView}>
          <View style={styles.backBtn}>
            {showBack && <TouchableOpacity
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
            }
            <View style={{ justifyContent: 'center', flex: 1, marginRight: 10 }}>
              {showTitle &&
                <Text style={{ color: '#fff', fontSize: 16 }} numberOfLines={1}>{title}</Text>
              }
            </View>
          </View>
        </View>
        }
        {realShowGG && (
          <VLCPlayerView
            {...this.props}
            videoAspectRatio={currentVideoAspectRatio}
            uri={ggUrl}
            source={{ uri: ggUrl, type: ggType }}
            type={ggType}
            isGG={true}
            showBack={showBack}
            showTitle={showTitle}
            isFull={isFull}
            onEnd={() => {
              onGGEnd?.();
              this.setState({ isEndGG: true });
            }}
            startFullScreen={this._toFullScreen}
            closeFullScreen={this._closeFullScreen}
          />
        )}

        {showVideo && (
          <VLCPlayerView
            {...this.props}
            uri={currentUrl}
            videoAspectRatio={currentVideoAspectRatio}
            onLeftPress={onLeftPress}
            title={title}
            type={type}
            isFull={isFull}
            showBack={showBack}
            showTitle={showTitle}
            hadGG={true}
            isEndGG={isEndGG}
            style={showGG && !isEndGG ? { position: 'absolute', zIndex: -1 } : {}}
            source={{ uri: currentUrl, type: type }}
            startFullScreen={this._toFullScreen}
            closeFullScreen={this._closeFullScreen}
            onEnd={() => {
              onEnd?.();
            }}
            onError={() => {
              onError?.();
            }}
          />
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  topView: {
    top: Platform.OS === 'ios' ? statusBarHeight : 0,
    left: 0,
    height: 45,
    position: 'absolute',
    width: '100%'
  },
  backBtn: {
    height: 45,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center'
  },
  btn: {
    marginLeft: 10,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    height: 40,
    borderRadius: 20,
    width: 40,
  }
});
