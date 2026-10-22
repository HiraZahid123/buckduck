import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { apiRequest, setAuthSession, getBackendUrl, setBackendUrl } from './src/services/api';
import { getMobileSocket, resetMobileSocket } from './src/services/socket';

export default function App() {
  // Authentication & Driver state
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'jobs' | 'route' | 'earnings'>('home');
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);

  // Login form state
  const [email, setEmail] = useState('kwame.driver@example.com');
  const [password, setPassword] = useState('password123');
  const [serverHost, setServerHost] = useState(getBackendUrl());
  const [showConfig, setShowConfig] = useState(false);

  // App data
  const [jobs, setJobs] = useState<any[]>([]);
  const [routeOrders, setRouteOrders] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>(null);

  // Delivery Modal
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [proofNote, setProofNote] = useState('Handed directly to customer at front door');

  // AUTO-ONLINE ON APP OPEN / DRIVER LOGIN
  const triggerAutoOnline = async (authToken: string, driverUser: any) => {
    setIsOnline(true);
    try {
      const socket = getMobileSocket();
      socket.emit('driver:toggle_online', {
        driverId: driverUser.id,
        online: true,
        name: driverUser.name,
      });

      await apiRequest('/api/driver/toggle-online', {
        method: 'POST',
        body: JSON.stringify({ online: true }),
      });
      console.log('Driver automatically set ONLINE on app launch!');
    } catch (err: any) {
      console.warn('Auto-online trigger error:', err.message);
    }
  };

  // Real-time WebSocket connection to listen for fleet updates
  useEffect(() => {
    if (!user) return;

    const socket = getMobileSocket();
    const handleStatus = (data: { driverId: number; online: boolean }) => {
      if (data.driverId === user.id) {
        setIsOnline(Boolean(data.online));
      }
    };

    socket.on('driver:status', handleStatus);
    socket.on('order:status', () => {
      loadDriverData();
    });

    return () => {
      socket.off('driver:status', handleStatus);
    };
  }, [user]);

  const loadDriverData = async () => {
    if (!token) return;
    try {
      const [jobsData, routeData, earningsData] = await Promise.all([
        apiRequest('/api/driver/jobs').catch(() => []),
        apiRequest('/api/driver/route').catch(() => []),
        apiRequest('/api/driver/earnings').catch(() => null),
      ]);
      setJobs(jobsData || []);
      setRouteOrders(routeData || []);
      setEarnings(earningsData);
    } catch (err) {
      console.warn('Error loading driver data:', err);
    }
  };

  useEffect(() => {
    if (user && token) {
      loadDriverData();
      const interval = setInterval(loadDriverData, 12000);
      return () => clearInterval(interval);
    }
  }, [user, token]);

  // Login handler
  const handleLogin = async (loginEmail?: string, loginPassword?: string) => {
    setLoading(true);
    try {
      if (serverHost) {
        setBackendUrl(serverHost);
      }
      const targetEmail = loginEmail || email;
      const targetPass = loginPassword || password;

      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail, pass: targetPass }),
      });

      if (res.user.role !== 'driver' && res.user.role !== 'admin') {
        Alert.alert('Access Denied', 'This app is exclusively for delivery drivers.');
        return;
      }

      setAuthSession(res.token, res.user);
      setToken(res.token);
      setUser(res.user);

      // AUTOMATICALLY SET DRIVER ONLINE UPON OPENING/LOGIN
      await triggerAutoOnline(res.token, res.user);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  // Demo Login
  const handleDemoLogin = async (role: 'driver') => {
    setLoading(true);
    try {
      if (serverHost) {
        setBackendUrl(serverHost);
      }
      const res = await apiRequest('/api/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });

      setAuthSession(res.token, res.user);
      setToken(res.token);
      setUser(res.user);

      // AUTOMATICALLY SET DRIVER ONLINE UPON OPENING/LOGIN
      await triggerAutoOnline(res.token, res.user);
    } catch (err: any) {
      Alert.alert('Demo Login Error', err.message || 'Could not connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle Online/Offline manually
  const handleToggleOnline = async () => {
    const nextOnline = !isOnline;
    setIsOnline(nextOnline);
    try {
      const socket = getMobileSocket();
      socket.emit('driver:toggle_online', {
        driverId: user.id,
        online: nextOnline,
        name: user.name,
      });

      await apiRequest('/api/driver/toggle-online', {
        method: 'POST',
        body: JSON.stringify({ online: nextOnline }),
      });
    } catch (err: any) {
      Alert.alert('Error', 'Could not update status');
      setIsOnline(!nextOnline);
    }
  };

  // Claim Job
  const handleAcceptJob = async (orderId: number) => {
    try {
      await apiRequest(`/api/driver/jobs/${orderId}/accept`, {
        method: 'POST',
      });
      Alert.alert('Job Claimed!', 'Order added to your Saturday route.');
      await loadDriverData();
      setActiveTab('route');
    } catch (err: any) {
      Alert.alert('Claim Failed', err.message || 'Could not accept job.');
    }
  };

  // Complete Delivery
  const handleCompleteDelivery = async () => {
    if (!selectedOrder) return;
    try {
      await apiRequest(`/api/driver/orders/${selectedOrder.id}/deliver`, {
        method: 'POST',
        body: JSON.stringify({
          note: proofNote,
          photoUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400',
        }),
      });
      Alert.alert('Delivery Confirmed', `Order #${selectedOrder.number} marked delivered!`);
      setSelectedOrder(null);
      await loadDriverData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to complete delivery');
    }
  };

  const handleSignOut = async () => {
    try {
      if (user) {
        const socket = getMobileSocket();
        socket.emit('driver:toggle_online', {
          driverId: user.id,
          online: false,
          name: user.name,
        });
        await apiRequest('/api/driver/toggle-online', {
          method: 'POST',
          body: JSON.stringify({ online: false }),
        }).catch(() => {});
      }
    } finally {
      resetMobileSocket();
      setAuthSession(null, null);
      setUser(null);
      setToken(null);
      setIsOnline(false);
    }
  };

  // RENDER: LOGIN SCREEN
  if (!user) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0B1F4B" />
        <ScrollView contentContainerStyle={styles.authScroll}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoEmoji}>🚚</Text>
          </View>
          <Text style={styles.appTitle}>BuckDuck Driver</Text>
          <Text style={styles.appSubtitle}>Saturday Fleet Logistics · Washington Metro</Text>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Driver Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="driver@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.btnGold, loading && { opacity: 0.7 }]}
              onPress={() => handleLogin()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#1E293B" />
              ) : (
                <Text style={styles.btnGoldText}>Sign In & Go Online</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR FAST TEST</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.btnDemo}
              onPress={() => handleDemoLogin('driver')}
              disabled={loading}
            >
              <Text style={styles.btnDemoText}>⚡ 1-Tap Driver Login (Auto-Online)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.configToggle}
              onPress={() => setShowConfig(!showConfig)}
            >
              <Text style={styles.configToggleText}>
                {showConfig ? 'Hide Server Configuration' : '⚙️ Server Connection Settings'}
              </Text>
            </TouchableOpacity>

            {showConfig && (
              <View style={styles.configBox}>
                <Text style={styles.configLabel}>Backend API URL:</Text>
                <TextInput
                  style={styles.configInput}
                  value={serverHost}
                  onChangeText={setServerHost}
                  placeholder="http://10.0.2.2:4000"
                />
                <Text style={styles.configHint}>
                  • Android Emulator: http://10.0.2.2:4000{'\n'}
                  • iOS Simulator: http://localhost:4000{'\n'}
                  • Real Phone: http://192.168.x.x:4000
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // RENDER: MAIN DRIVER PORTAL
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1F4B" />

      {/* Top App Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brandTitle}>BUCKDUCK DRIVER</Text>
          <Text style={styles.driverGreeting}>Hi, {user.name.split(' ')[0]}</Text>
        </View>

        <View style={styles.headerRight}>
          <View style={[styles.socketBadge, { backgroundColor: isOnline ? '#15803D' : '#64748B' }]}>
            <View style={styles.pulsingDot} />
            <Text style={styles.socketText}>{isOnline ? 'LIVE ONLINE' : 'OFFLINE'}</Text>
          </View>

          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Real-time Status Switch Bar */}
      <View style={[styles.statusBarWrap, { backgroundColor: isOnline ? '#064E3B' : '#1E293B' }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>
            {isOnline ? "● You're Online & Active" : "○ You're Offline"}
          </Text>
          <Text style={styles.statusSub}>
            {isOnline ? 'Receiving Saturday route assignments' : 'Go online to receive delivery offers'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.switchTrack, isOnline && styles.switchTrackOn]}
          onPress={handleToggleOnline}
        >
          <View style={[styles.switchThumb, isOnline && styles.switchThumbOn]} />
        </TouchableOpacity>
      </View>

      {/* Main Tab Content */}
      <ScrollView contentContainerStyle={styles.contentScroll}>
        {/* TAB 1: HOME DASHBOARD */}
        {activeTab === 'home' && (
          <View style={styles.tabContent}>
            {/* Vehicle Card */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.cardMuted}>Assigned Van / Vehicle</Text>
                  <Text style={styles.cardValue}>{user.vehicle || 'Toyota Sienna · Silver'}</Text>
                </View>
                <Text style={{ fontSize: 28 }}>🚗</Text>
              </View>
              <Text style={styles.tinyMuted}>Dispatch Hub: Four Corners / Silver Spring Metro</Text>
            </View>

            {/* Quick Metrics */}
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricNum}>{routeOrders.length}</Text>
                <Text style={styles.metricLabel}>Assigned Stops</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricNum}>{jobs.length}</Text>
                <Text style={styles.metricLabel}>Ready Jobs</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricNum}>
                  ${(((earnings?.totalEarnedCents || 15500)) / 100).toFixed(0)}
                </Text>
                <Text style={styles.metricLabel}>Today's Pay</Text>
              </View>
            </View>

            {/* Next Action Promo */}
            {jobs.length > 0 && (
              <TouchableOpacity
                style={styles.promoCard}
                onPress={() => setActiveTab('jobs')}
              >
                <Text style={styles.promoTag}>SATURDAY DISPATCH OPEN</Text>
                <Text style={styles.promoTitle}>{jobs.length} Unassigned orders waiting</Text>
                <Text style={styles.promoBtnText}>View & Claim Delivery Jobs →</Text>
              </TouchableOpacity>
            )}

            {routeOrders.length > 0 && (
              <TouchableOpacity
                style={[styles.promoCard, { backgroundColor: '#1E3A8A' }]}
                onPress={() => setActiveTab('route')}
              >
                <Text style={styles.promoTag}>IN PROGRESS</Text>
                <Text style={styles.promoTitle}>Active Route ({routeOrders.length} Stops)</Text>
                <Text style={styles.promoBtnText}>Open Delivery Sequence →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* TAB 2: JOBS BOARD */}
        {activeTab === 'jobs' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Available Saturday Jobs</Text>
            <Text style={styles.sectionSub}>Orders packed and ready for van pickup</Text>

            {jobs.map((j) => (
              <View key={j.id} style={styles.jobCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.jobStore}>
                    {j.store?.emoji || '🏪'} {j.store?.name}
                  </Text>
                  <Text style={styles.jobPay}>
                    ${((j.driverPayCents + (j.tipCents || 0)) / 100).toFixed(2)}
                  </Text>
                </View>

                <Text style={styles.jobAddress}>
                  📍 Pickup: {j.store?.city || 'Silver Spring'}, {j.store?.state || 'MD'}
                </Text>
                <Text style={styles.jobAddress}>
                  📦 Destination: {j.destinationCity || 'Downtown Silver Spring'} ({j.destinationZip})
                </Text>

                <View style={styles.jobFooter}>
                  <Text style={styles.jobBags}>🛍️ {j.bags || 1} Bag(s)</Text>
                  <TouchableOpacity
                    style={styles.claimBtn}
                    onPress={() => handleAcceptJob(j.id)}
                  >
                    <Text style={styles.claimBtnText}>Claim Job</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {jobs.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>✓</Text>
                <Text style={styles.emptyTitle}>All Jobs Claimed</Text>
                <Text style={styles.emptyText}>You're caught up. Check your active route.</Text>
              </View>
            )}
          </View>
        )}

        {/* TAB 3: ROUTE SEQUENCE */}
        {activeTab === 'route' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>My Active Route</Text>
            <Text style={styles.sectionSub}>{routeOrders.length} Stops remaining today</Text>

            {routeOrders.map((ro, index) => (
              <View key={ro.id} style={styles.routeCard}>
                <View style={styles.stopBadge}>
                  <Text style={styles.stopNum}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeOrderNum}>Order #{ro.number}</Text>
                  <Text style={styles.routeCustomer}>👤 {ro.customerName || 'Customer'}</Text>
                  <Text style={styles.routeAddress}>{ro.address || 'Silver Spring, MD'}</Text>
                  <Text style={styles.routeWindow}>
                    🕒 {ro.delivery_windows?.start_time || '12:00'} - {ro.delivery_windows?.end_time || '16:00'}
                  </Text>

                  <TouchableOpacity
                    style={styles.deliverBtn}
                    onPress={() => setSelectedOrder(ro)}
                  >
                    <Text style={styles.deliverBtnText}>Confirm Delivery & Proof</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {routeOrders.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🎉</Text>
                <Text style={styles.emptyTitle}>Route Complete!</Text>
                <Text style={styles.emptyText}>All packages delivered safely. Great job!</Text>
              </View>
            )}
          </View>
        )}

        {/* TAB 4: EARNINGS */}
        {activeTab === 'earnings' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Saturday Earnings</Text>
            <View style={styles.earningsHero}>
              <Text style={styles.earningsTotal}>
                ${(((earnings?.totalEarnedCents || 15500)) / 100).toFixed(2)}
              </Text>
              <Text style={styles.earningsTotalSub}>Net Pay + 100% Customer Tips</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.payoutRow}>
                <Text style={styles.payoutLabel}>Base Delivery Pay</Text>
                <Text style={styles.payoutVal}>
                  ${(((earnings?.basePayCents || 12500)) / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.payoutRow}>
                <Text style={styles.payoutLabel}>Customer Tips (100% yours)</Text>
                <Text style={styles.payoutVal}>
                  ${(((earnings?.totalTipsCents || 3000)) / 100).toFixed(2)}
                </Text>
              </View>
              <View style={[styles.payoutRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.payoutLabel}>Completed Deliveries</Text>
                <Text style={styles.payoutVal}>{earnings?.deliveryCount || 8} stops</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Mobile Navigation Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('home')}
        >
          <Text style={[styles.tabIcon, activeTab === 'home' && styles.tabActive]}>🏠</Text>
          <Text style={[styles.tabText, activeTab === 'home' && styles.tabTextActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('jobs')}
        >
          <Text style={[styles.tabIcon, activeTab === 'jobs' && styles.tabActive]}>📦</Text>
          <Text style={[styles.tabText, activeTab === 'jobs' && styles.tabTextActive]}>Jobs ({jobs.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('route')}
        >
          <Text style={[styles.tabIcon, activeTab === 'route' && styles.tabActive]}>🗺️</Text>
          <Text style={[styles.tabText, activeTab === 'route' && styles.tabTextActive]}>Route ({routeOrders.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('earnings')}
        >
          <Text style={[styles.tabIcon, activeTab === 'earnings' && styles.tabActive]}>💵</Text>
          <Text style={[styles.tabText, activeTab === 'earnings' && styles.tabTextActive]}>Earnings</Text>
        </TouchableOpacity>
      </View>

      {/* Proof of Delivery Modal */}
      <Modal visible={Boolean(selectedOrder)} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Proof of Delivery</Text>
            <Text style={styles.modalSub}>Order #{selectedOrder?.number}</Text>

            <Text style={styles.fieldLabel}>Dropoff Note</Text>
            <TextInput
              style={styles.modalInput}
              value={proofNote}
              onChangeText={setProofNote}
              placeholder="e.g. Left on front porch behind pillar"
            />

            <View style={styles.photoBox}>
              <Text style={{ fontSize: 24, marginBottom: 4 }}>📸</Text>
              <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '600' }}>Photo captured (simulated)</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.btnSecondary, { flex: 1 }]}
                onPress={() => setSelectedOrder(null)}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnGold, { flex: 2 }]}
                onPress={handleCompleteDelivery}
              >
                <Text style={styles.btnGoldText}>Confirm Delivery</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  authContainer: {
    flex: 1,
    backgroundColor: '#0B1F4B',
  },
  authScroll: {
    padding: 24,
    justifyContent: 'center',
    minHeight: '100%',
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#E0A82E',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 32,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 28,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 16,
  },
  btnGold: {
    backgroundColor: '#E0A82E',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnGoldText: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '800',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  btnDemo: {
    backgroundColor: '#0B1F4B',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnDemoText: {
    color: '#FDE047',
    fontSize: 15,
    fontWeight: '700',
  },
  configToggle: {
    marginTop: 18,
    alignItems: 'center',
  },
  configToggleText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  configBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  configLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  configInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
  },
  configHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 16,
  },
  header: {
    backgroundColor: '#0B1F4B',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  brandTitle: {
    color: '#E0A82E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  driverGreeting: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  socketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  socketText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  signOutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 6,
  },
  signOutText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBarWrap: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statusSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#475569',
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: '#10B981',
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  contentScroll: {
    padding: 16,
    paddingBottom: 80,
  },
  tabContent: {},
  cardMuted: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  tinyMuted: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricNum: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0B1F4B',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  promoCard: {
    backgroundColor: '#0B1F4B',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },
  promoTag: {
    color: '#E0A82E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  promoTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginVertical: 6,
  },
  promoBtnText: {
    color: '#FDE047',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  jobStore: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  jobPay: {
    fontSize: 18,
    fontWeight: '800',
    color: '#15803D',
  },
  jobAddress: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  jobBags: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  claimBtn: {
    backgroundColor: '#0B1F4B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  claimBtnText: {
    color: '#FDE047',
    fontWeight: '800',
    fontSize: 13,
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stopBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0B1F4B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopNum: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  routeOrderNum: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  routeCustomer: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    marginTop: 2,
  },
  routeAddress: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  routeWindow: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '700',
    marginTop: 4,
  },
  deliverBtn: {
    backgroundColor: '#15803D',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  deliverBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  earningsHero: {
    backgroundColor: '#0B1F4B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  earningsTotal: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FDE047',
  },
  earningsTotalSub: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  payoutLabel: {
    fontSize: 14,
    color: '#475569',
  },
  payoutVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.6,
  },
  tabActive: {
    opacity: 1,
  },
  tabText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  tabTextActive: {
    color: '#0B1F4B',
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  photoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#475569',
    fontWeight: '700',
  },
});
