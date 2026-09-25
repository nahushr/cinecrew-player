/**
 * Created by yuanzhou.xu on 2018/5/16.
 */
import React, { Component } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default class ControlBtn extends Component {
  static defaultProps = {
    titleGolive: 'Go live',
    showLeftButton: true,
    showMiddleButton: true,
    showRightButton: true
  }

  render() {
    let {
      paused,
      isFull,
      showGoLive,
      onGoLivePress,
      onReplayPress,
      onPausedPress,
      onFullPress,
      titleGolive,
      showLeftButton,
      showMiddleButton,
      showRightButton,
      style
    } = this.props;
    return (
      <View style={[styles.controls, style]}>
        <View style={styles.controlContainer}>
          <TouchableOpacity style={styles.controlContent} activeOpacity={1}>
            <View style={styles.controlContent2}>
              <View style={styles.right}>
                {
                  showLeftButton ? (
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => onReplayPress?.()}
                      style={{ width: 50, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={'replay'} size={30} color="#fff" />
                    </TouchableOpacity>
                  ) : <View style={{ width: 50 }} />
                }
                <Text
                  style={{ fontSize: 11, color: '#fff' }}>       </Text>
              </View>

              {
                showMiddleButton && (
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => onPausedPress?.(!paused)}
                    style={{ width: 50, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={paused ? 'play' : 'pause'} size={30} color="#fff" />
                  </TouchableOpacity>
                )
              }

              <View style={styles.right}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => onGoLivePress?.()}>
                  <Text
                    style={{ fontSize: 11, color: '#fff' }}>{showGoLive ? titleGolive : '       '}</Text>
                </TouchableOpacity>
                {
                  showRightButton ? (
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => onFullPress?.(!isFull)}
                      style={{ width: 50, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={isFull ? 'fullscreen-exit' : 'fullscreen'} size={30} color="#fff" />
                    </TouchableOpacity>
                  ) : <View style={{ width: 50 }} />
                }
              </View>

            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    //backgroundColor: '#000',
  },
  controls: {
    width: '100%',
    height: 50,
  },
  rateControl: {
    flex: 0,
    flexDirection: 'row',
    marginTop: 10,
    marginLeft: 10,
    //backgroundColor: 'rgba(0,0,0,0.5)',
    width: 120,
    height: 30,
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 10,
  },
  controlOption: {
    textAlign: 'center',
    fontSize: 13,
    color: '#fff',
    width: 30,
    //lineHeight: 12,
  },
  controlContainer: {
    flex: 1,
    //padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  controlContent: {
    width: '100%',
    height: 50,
    //borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  controlContent2: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  progress: {
    flex: 1,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 6,
    height: 18,
    backgroundColor: '#fff',
    borderRadius: 4,
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
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
