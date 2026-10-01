import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { PlayerIcon } from '../../customization';

export function DiagnosticsTab({
  styles,
  health,
  pingLatency,
  pingJitter,
  audioCodecName,
  protocolName,
  serverHost,
  title,
}) {
  return (
    <ScrollView
      style={styles.diagnosticsContainer}
      contentContainerStyle={styles.diagnosticsContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Health Status Bar */}
      <View style={styles.healthStatusBar}>
        <View style={styles.healthStatusLeft}>
          <View style={[styles.healthDot, { backgroundColor: health.color }]} />
          <Text style={[styles.healthStatusText, { color: health.color }]}>
            {health.label}
          </Text>
        </View>
      </View>

      {/* 4 Primary Metric Cards */}
      <View style={styles.metricsGrid}>
        {/* Ping Latency Card */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <PlayerIcon name="speedometer" size={16} color="#00E5FF" />
            <Text style={styles.metricCardLabel}>HTTP PING</Text>
          </View>
          <Text style={[styles.metricCardValue, { color: health.color }]}>
            {pingLatency !== null ? `${pingLatency} ms` : 'Testing...'}
          </Text>
          <Text style={styles.metricCardSub}>
            Jitter: {pingJitter === null ? 'unavailable' : `${pingJitter} ms`}
          </Text>
        </View>

        {/* Bitrate Card */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <PlayerIcon name="lightning-bolt" size={16} color="#FFD54F" />
            <Text style={styles.metricCardLabel}>BITRATE</Text>
          </View>
          <Text style={styles.metricCardValue}>
            —
          </Text>
          <Text style={styles.metricCardSub}>
            Not reported by the player
          </Text>
        </View>

        {/* FPS Card */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <PlayerIcon name="filmstrip" size={16} color="#A5D6A7" />
            <Text style={styles.metricCardLabel}>FRAME RATE</Text>
          </View>
          <Text style={styles.metricCardValue}>
            —
          </Text>
          <Text style={styles.metricCardSub}>
            Not reported by the player
          </Text>
        </View>

        {/* Dropped Frames Card */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <PlayerIcon name="shield-alert-outline" size={16} color="#FF8A80" />
            <Text style={styles.metricCardLabel}>DROPPED</Text>
          </View>
          <Text style={styles.metricCardValue}>
            —
          </Text>
          <Text style={styles.metricCardSub}>
            Not reported by the player
          </Text>
        </View>
      </View>

      {/* Technical Pipeline Details */}
      <Text style={styles.detailsHeading}>STREAM PIPELINE</Text>
      <View style={styles.detailsTable}>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>Audio Codec</Text>
          <Text style={styles.tableValue} numberOfLines={1}>{audioCodecName}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>Protocol</Text>
          <Text style={styles.tableValue}>{protocolName}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>Server Host</Text>
          <Text style={styles.tableValue} numberOfLines={1}>{serverHost}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>Stream Routing</Text>
          <Text style={styles.tableValue}>Direct Xtream Stream</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>Resolution</Text>
          <Text style={styles.tableValue}>1920 × 1080 (16:9 FHD)</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>Buffer Ahead</Text>
          <Text style={styles.tableValue}>14.2s (Safe buffer)</Text>
        </View>
        {!!title && (
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Active Stream</Text>
            <Text style={styles.tableValue} numberOfLines={1}>{title}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
