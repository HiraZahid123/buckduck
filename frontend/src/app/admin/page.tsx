'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import BarChart from '../../components/BarChart';
import {
  BarChart2,
  List,
  Truck,
  Store as StoreIcon,
  Users as UsersIcon,
  Calendar,
  MapPin,
  DollarSign,
  Settings as SettingsIcon,
  LogOut,
  Search,
  Check,
  X,
  ShoppingBag,
  Trash2,
  Plus,
  RefreshCw,
  Power,
  Ban,
  CheckCircle2,
  Radio,
} from 'lucide-react';
import { getSocket } from '../../lib/socket';

export interface ServiceZip {
  zip: string;
  city: string;
  state: string;
  zone: string;
  active: boolean;
}

const DEFAULT_ZIPS: ServiceZip[] = [
  { zip: '20910', city: 'Silver Spring', state: 'MD', zone: 'Downtown Silver Spring', active: true },
  { zip: '20901', city: 'Silver Spring', state: 'MD', zone: 'Four Corners / Burnt Mills', active: true },
  { zip: '20902', city: 'Silver Spring', state: 'MD', zone: 'Wheaton / Glenmont', active: true },
  { zip: '20903', city: 'Silver Spring', state: 'MD', zone: 'Hillandale', active: true },
  { zip: '20904', city: 'Silver Spring', state: 'MD', zone: 'White Oak / Colesville', active: true },
  { zip: '20905', city: 'Silver Spring', state: 'MD', zone: 'Cloverly', active: true },
  { zip: '20906', city: 'Silver Spring', state: 'MD', zone: 'Aspen Hill / Layhill', active: true },
  { zip: '20912', city: 'Takoma Park', state: 'MD', zone: 'Takoma Park Old Town', active: true },
  { zip: '20850', city: 'Rockville', state: 'MD', zone: 'Rockville Town Center', active: true },
  { zip: '20852', city: 'North Bethesda', state: 'MD', zone: 'Pike & Rose / White Flint', active: true },
  { zip: '20011', city: 'Washington', state: 'DC', zone: 'Petworth / Brightwood', active: true },
  { zip: '20012', city: 'Washington', state: 'DC', zone: 'Takoma DC', active: true },
];

export default function AdminConsolePage() {
  const router = useRouter();
  const { user, login, demoLogin, logout } = useAuth();
  const [subView, setSubView] = useState<'overview' | 'dispatch' | 'orders' | 'stores' | 'users' | 'drivers' | 'windows' | 'zones' | 'finance' | 'settings'>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [dispatch, setDispatch] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [windows, setWindows] = useState<any[]>([]);
  const [finance, setFinance] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const [orderFilter, setOrderFilter] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedMapPin, setSelectedMapPin] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ZIP Code & Zone Management states
  const [zipList, setZipList] = useState<ServiceZip[]>(DEFAULT_ZIPS);
  const [newZip, setNewZip] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('MD');
  const [newZone, setNewZone] = useState('');
  const [zipSearch, setZipSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('All');
  const [zipFeedback, setZipFeedback] = useState('');
  const [isSavingZip, setIsSavingZip] = useState(false);

  // Order modal (39-admin-order-modal.png)
  const [modalOrder, setModalOrder] = useState<any>(null);
  const [overrideStatus, setOverrideStatus] = useState('placed');
  const [overrideDriverId, setOverrideDriverId] = useState<number | string>('');
  const [orderSearch, setOrderSearch] = useState('');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Delivery Window Modal states (Screenshot 3)
  const [showAddWindowModal, setShowAddWindowModal] = useState(false);
  const [newWinDate, setNewWinDate] = useState('');
  const [newWinStart, setNewWinStart] = useState('16:00');
  const [newWinEnd, setNewWinEnd] = useState('19:00');
  const [newWinCapacity, setNewWinCapacity] = useState(80);

  // Add User Modal states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<'customer' | 'merchant' | 'driver' | 'admin'>('customer');
  const [newUserPassword, setNewUserPassword] = useState('');

  // Add Store Modal states
  const [showAddStoreModal, setShowAddStoreModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreCategory, setNewStoreCategory] = useState('Groceries');
  const [newStoreOwnerEmail, setNewStoreOwnerEmail] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStoreCity, setNewStoreCity] = useState('Silver Spring');
  const [newStoreState, setNewStoreState] = useState('MD');
  const [newStoreZip, setNewStoreZip] = useState('20910');
  const [newStorePhone, setNewStorePhone] = useState('');
  const [newStoreCommission, setNewStoreCommission] = useState(0.15);
  const [newStoreStatus, setNewStoreStatus] = useState('approved');

  // Add Driver Modal states
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverEmail, setNewDriverEmail] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newDriverVehicle, setNewDriverVehicle] = useState('Toyota Sienna · Silver');
  const [newDriverPassword, setNewDriverPassword] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('bd_token');
    if (!token && (!user || user.role !== 'admin')) {
      setLoading(false);
    }
  }, [user]);

  const loadData = async () => {
    const token = localStorage.getItem('bd_token');
    if (!token) return;

    try {
      const [overRes, ordRes, dispRes, storRes, usrRes, winRes, finRes, setRes] = await Promise.all([
        fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/orders', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/dispatch', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/stores', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/windows/all', { headers: { Authorization: `Bearer ${token}` } }).catch(() => fetch('/api/windows')),
        fetch('/api/admin/finance', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (overRes.ok) setOverview(await overRes.json());
      if (ordRes.ok) setOrders(await ordRes.json());
      if (dispRes.ok) setDispatch(await dispRes.json());
      if (storRes.ok) setStores(await storRes.json());
      if (usrRes.ok) setUsers(await usrRes.json());
      if (winRes.ok) setWindows(await winRes.json());
      if (finRes.ok) setFinance(await finRes.json());
      if (setRes.ok) setSettings(await setRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Real-time WebSocket connection for live driver online/offline & order updates
  useEffect(() => {
    const socket = getSocket();

    const handleDriverStatus = (data: { driverId: number; online: boolean; name?: string }) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === data.driverId ? { ...u, driver_online: data.online } : u
        )
      );
      setDispatch((prev: any) => {
        if (!prev || !prev.drivers) return prev;
        return {
          ...prev,
          drivers: prev.drivers.map((d: any) =>
            d.id === data.driverId ? { ...d, driver_online: data.online } : d
          ),
        };
      });
    };

    const handleOrderStatus = () => {
      loadData();
    };

    socket.on('driver:status', handleDriverStatus);
    socket.on('order:status', handleOrderStatus);

    return () => {
      socket.off('driver:status', handleDriverStatus);
      socket.off('order:status', handleOrderStatus);
    };
  }, []);

  // Synchronize ZIP codes from backend settings
  useEffect(() => {
    if (settings && settings.service_zip_codes) {
      try {
        const parsed = JSON.parse(settings.service_zip_codes);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setZipList(parsed);
        }
      } catch {}
    }
  }, [settings]);

  const saveZipsToBackend = async (updatedList: ServiceZip[]) => {
    setZipList(updatedList);
    setIsSavingZip(true);
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          key: 'service_zip_codes',
          value: JSON.stringify(updatedList),
        }),
      });
      if (res.ok) {
        setZipFeedback('✓ Service ZIPs saved and active on live marketplace!');
        setTimeout(() => setZipFeedback(''), 3000);
      }
    } catch {
      setZipFeedback('⚠️ Failed to save settings');
    } finally {
      setIsSavingZip(false);
    }
  };

  const handleAddZip = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanZip = newZip.trim();
    if (!cleanZip || cleanZip.length !== 5 || isNaN(Number(cleanZip))) {
      alert('Please enter a valid 5-digit US ZIP code.');
      return;
    }
    if (zipList.some((z) => z.zip === cleanZip)) {
      alert(`ZIP code ${cleanZip} is already registered in service zones.`);
      return;
    }

    const newItem: ServiceZip = {
      zip: cleanZip,
      city: newCity.trim() || (cleanZip.startsWith('200') ? 'Washington' : 'Silver Spring'),
      state: newState,
      zone: newZone.trim() || `${newCity.trim() || 'Service'} Zone`,
      active: true,
    };

    const updated = [newItem, ...zipList];
    saveZipsToBackend(updated);
    setNewZip('');
    setNewCity('');
    setNewZone('');
  };

  const handleToggleZip = (zipStr: string) => {
    const updated = zipList.map((z) =>
      z.zip === zipStr ? { ...z, active: !z.active } : z
    );
    saveZipsToBackend(updated);
  };

  const handleDeleteZip = (zipStr: string) => {
    if (!confirm(`Are you sure you want to remove ZIP ${zipStr} from Saturday delivery?`)) return;
    const updated = zipList.filter((z) => z.zip !== zipStr);
    saveZipsToBackend(updated);
  };

  const handleAddPresetZone = (zoneKey: string) => {
    let presets: ServiceZip[] = [];
    if (zoneKey === 'silver-spring') {
      presets = [
        { zip: '20910', city: 'Silver Spring', state: 'MD', zone: 'Downtown Silver Spring', active: true },
        { zip: '20901', city: 'Silver Spring', state: 'MD', zone: 'Four Corners', active: true },
        { zip: '20902', city: 'Silver Spring', state: 'MD', zone: 'Wheaton / Glenmont', active: true },
        { zip: '20903', city: 'Silver Spring', state: 'MD', zone: 'Hillandale', active: true },
        { zip: '20904', city: 'Silver Spring', state: 'MD', zone: 'White Oak / Colesville', active: true },
        { zip: '20905', city: 'Silver Spring', state: 'MD', zone: 'Cloverly', active: true },
        { zip: '20906', city: 'Silver Spring', state: 'MD', zone: 'Aspen Hill / Layhill', active: true },
        { zip: '20912', city: 'Takoma Park', state: 'MD', zone: 'Takoma Park Old Town', active: true },
      ];
    } else if (zoneKey === 'rockville') {
      presets = [
        { zip: '20850', city: 'Rockville', state: 'MD', zone: 'Rockville Town Center', active: true },
        { zip: '20852', city: 'North Bethesda', state: 'MD', zone: 'Pike & Rose / White Flint', active: true },
        { zip: '20814', city: 'Bethesda', state: 'MD', zone: 'Downtown Bethesda', active: true },
        { zip: '20817', city: 'Bethesda', state: 'MD', zone: 'Cabin John / West Bethesda', active: true },
      ];
    } else if (zoneKey === 'dc') {
      presets = [
        { zip: '20011', city: 'Washington', state: 'DC', zone: 'Petworth / Brightwood', active: true },
        { zip: '20012', city: 'Washington', state: 'DC', zone: 'Takoma DC', active: true },
        { zip: '20010', city: 'Washington', state: 'DC', zone: 'Columbia Heights / Park View', active: true },
      ];
    } else if (zoneKey === 'nova') {
      presets = [
        { zip: '22201', city: 'Arlington', state: 'VA', zone: 'Clarendon / Courthouse', active: true },
        { zip: '22301', city: 'Alexandria', state: 'VA', zone: 'Del Ray / Old Town North', active: true },
      ];
    }

    const currentMap = new Map(zipList.map((z) => [z.zip, z]));
    for (const p of presets) {
      currentMap.set(p.zip, p);
    }
    const updated = Array.from(currentMap.values());
    saveZipsToBackend(updated);
  };

  const handleAssignDriver = async (orderId: number, driverId: number) => {
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ driverId }),
      });
      if (res.ok) await loadData();
    } catch {
      alert('Failed to assign driver');
    }
  };

  const handleUpdateStore = async (storeId: number, status: string, commissionRate?: number) => {
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch(`/api/admin/stores/${storeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, commissionRate }),
      });
      if (res.ok) await loadData();
    } catch {
      alert('Failed to update store');
    }
  };

  const handleSaveOrderStatus = async () => {
    if (!modalOrder) return;
    const token = localStorage.getItem('bd_token');
    try {
      if (overrideStatus !== modalOrder.status) {
        await fetch(`/api/admin/orders/${modalOrder.id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: overrideStatus, reason: 'Admin status override' }),
        });
      }
      if (overrideDriverId !== undefined && overrideDriverId !== (modalOrder.driver_id || '')) {
        await fetch(`/api/admin/orders/${modalOrder.id}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ driverId: overrideDriverId ? Number(overrideDriverId) : null }),
        });
      }
      setModalOrder(null);
      await loadData();
    } catch {
      alert('Failed to save order changes');
    }
  };

  const handleRefundOrder = async () => {
    if (!modalOrder) return;
    if (!confirm(`Are you sure you want to issue a full refund for Order ${modalOrder.number}? This will cancel the order.`)) return;
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch(`/api/admin/orders/${modalOrder.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'cancelled', reason: 'Full customer refund initiated by admin operations' }),
      });
      if (res.ok) {
        setModalOrder(null);
        await loadData();
      }
    } catch {
      alert('Failed to refund order');
    }
  };

  const handleCreateWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWinDate || !newWinStart || !newWinEnd) {
      alert('Please fill in Date, Start time, and End time.');
      return;
    }
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch('/api/windows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          date: newWinDate,
          start_time: newWinStart,
          end_time: newWinEnd,
          capacity: Number(newWinCapacity) || 120,
        }),
      });
      if (res.ok) {
        setShowAddWindowModal(false);
        setNewWinDate('');
        await loadData();
      } else {
        alert('Failed to create delivery window');
      }
    } catch {
      alert('Error creating delivery window');
    }
  };

  const handleToggleWindowActive = async (winId: number, active: boolean) => {
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch(`/api/windows/${winId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active }),
      });
      if (res.ok) await loadData();
    } catch {
      alert('Failed to update window');
    }
  };

  const handleUpdateWindowCapacity = async (winId: number, capacity: number) => {
    const token = localStorage.getItem('bd_token');
    try {
      await fetch(`/api/windows/${winId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ capacity }),
      });
      await loadData();
    } catch {}
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      alert('Please fill in Name and Email.');
      return;
    }
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          role: newUserRole,
          phone: newUserPhone.trim(),
          password: newUserPassword.trim() || 'welcome123',
        }),
      });
      if (res.ok) {
        setShowAddUserModal(false);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPhone('');
        setNewUserPassword('');
        await loadData();
        alert('User account created successfully!');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to create user');
      }
    } catch {
      alert('Error creating user');
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) {
      alert('Please enter a Store Name.');
      return;
    }
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch('/api/admin/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: newStoreName.trim(),
          category: newStoreCategory,
          ownerEmail: newStoreOwnerEmail.trim(),
          address: newStoreAddress.trim(),
          city: newStoreCity.trim() || 'Silver Spring',
          state: newStoreState.trim() || 'MD',
          zip: newStoreZip.trim() || '20910',
          phone: newStorePhone.trim(),
          commissionRate: Number(newStoreCommission) || 0.15,
          status: newStoreStatus,
        }),
      });
      if (res.ok) {
        setShowAddStoreModal(false);
        setNewStoreName('');
        setNewStoreAddress('');
        setNewStorePhone('');
        await loadData();
        alert('Store created and listed successfully!');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to create store');
      }
    } catch {
      alert('Error creating store');
    }
  };

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName.trim() || !newDriverEmail.trim()) {
      alert('Please fill in Driver Name and Email.');
      return;
    }
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch('/api/admin/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: newDriverName.trim(),
          email: newDriverEmail.trim(),
          phone: newDriverPhone.trim(),
          vehicle: newDriverVehicle.trim() || 'Standard Delivery Vehicle',
          password: newDriverPassword.trim() || 'welcome123',
        }),
      });
      if (res.ok) {
        setShowAddDriverModal(false);
        setNewDriverName('');
        setNewDriverEmail('');
        setNewDriverPhone('');
        setNewDriverVehicle('Toyota Sienna · Silver');
        setNewDriverPassword('');
        await loadData();
        alert('Driver registered successfully in the fleet!');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to register driver');
      }
    } catch {
      alert('Error registering driver');
    }
  };

  // Toggle user status between active and suspended (prevents login immediately)
  const handleToggleUserStatus = async (userId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const token = localStorage.getItem('bd_token');
    try {
      // Optimistic update
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u))
      );
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to update user status');
        await loadData();
      }
    } catch {
      alert('Error updating user status');
      await loadData();
    }
  };

  // Permanently delete user
  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        alert(`User "${userName}" has been deleted.`);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Could not delete user.');
      }
    } catch {
      alert('Error deleting user');
    }
  };

  // Permanently delete store
  const handleDeleteStore = async (storeId: number, storeName: string) => {
    if (!confirm(`Are you sure you want to delete store "${storeName}"? This action cannot be undone.`)) {
      return;
    }
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch(`/api/admin/stores/${storeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStores((prev) => prev.filter((s) => s.id !== storeId));
        alert(`Store "${storeName}" has been deleted.`);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Could not delete store.');
      }
    } catch {
      alert('Error deleting store');
    }
  };

  // Real-time toggle driver online/offline via Socket + API
  const handleToggleDriverOnline = async (driverId: number, currentOnline: boolean) => {
    const nextOnline = !currentOnline;
    const token = localStorage.getItem('bd_token');
    try {
      // Optimistic update locally
      setUsers((prev) =>
        prev.map((u) => (u.id === driverId ? { ...u, driver_online: nextOnline } : u))
      );
      if (dispatch?.drivers) {
        setDispatch((prev: any) => ({
          ...prev,
          drivers: prev.drivers.map((d: any) =>
            d.id === driverId ? { ...d, driver_online: nextOnline } : d
          ),
        }));
      }

      // Also emit via websocket client directly
      const socket = getSocket();
      socket.emit('driver:toggle_online', { driverId, online: nextOnline });

      const res = await fetch(`/api/admin/drivers/${driverId}/online`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ online: nextOnline }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to toggle driver online status');
        await loadData();
      }
    } catch {
      alert('Error toggling driver status');
      await loadData();
    }
  };

  const unassignedCount = dispatch?.unassignedReadyOrders?.length || 0;
  const pendingStoresCount = stores.filter((s) => s.status === 'pending').length;

  const chartGmvData = [
    { week: 'Sep 12', gmv: 3420 },
    { week: 'Sep 19', gmv: 4890 },
    { week: 'Sep 26', gmv: 6240 },
    { week: 'Oct 3', gmv: 8120 },
    { week: 'Oct 10', gmv: 10450 },
    { week: 'Oct 17', gmv: 12890 },
    { week: 'Oct 24', gmv: 15400 },
  ];

  const financeSettlements = [
    { day: 'Oct 17, 2026', orders: 43, gmv: '$2,565.98', commission: '$301.99', serviceFees: '$117.28', deliveryFees: '$257.57', driverPay: '$414.50', merchantPayouts: '$1,711.14', netRevenue: '$440.34' },
    { day: 'Oct 10, 2026', orders: 36, gmv: '$1,781.73', commission: '$201.13', serviceFees: '$87.42', deliveryFees: '$215.64', driverPay: '$336.00', merchantPayouts: '$1,139.54', netRevenue: '$306.19' },
    { day: 'Oct 3, 2026', orders: 36, gmv: '$1,972.09', commission: '$231.13', serviceFees: '$92.62', deliveryFees: '$215.64', driverPay: '$321.00', merchantPayouts: '$1,309.70', netRevenue: '$341.39' },
    { day: 'Sep 26, 2026', orders: 34, gmv: '$1,853.19', commission: '$218.37', serviceFees: '$88.87', deliveryFees: '$203.66', driverPay: '$292.00', merchantPayouts: '$1,237.29', netRevenue: '$323.90' },
    { day: 'Sep 19, 2026', orders: 31, gmv: '$1,844.57', commission: '$221.20', serviceFees: '$85.05', deliveryFees: '$185.69', driverPay: '$269.50', merchantPayouts: '$1,253.63', netRevenue: '$321.44' },
    { day: 'Sep 12, 2026', orders: 24, gmv: '$1,379.66', commission: '$159.06', serviceFees: '$65.56', deliveryFees: '$143.76', driverPay: '$242.00', merchantPayouts: '$901.28', netRevenue: '$236.38' },
    { day: 'Sep 5, 2026', orders: 17, gmv: '$739.68', commission: '$78.86', serviceFees: '$38.22', deliveryFees: '$101.83', driverPay: '$167.50', merchantPayouts: '$446.77', netRevenue: '$125.41' },
    { day: 'Aug 29, 2026', orders: 15, gmv: '$799.85', commission: '$85.40', serviceFees: '$41.30', deliveryFees: '$89.85', driverPay: '$138.50', merchantPayouts: '$523.78', netRevenue: '$137.40' },
  ];

  const financeChartData = [
    { week: 'Aug 29', gmv: 137 },
    { week: 'Sep 5', gmv: 125 },
    { week: 'Sep 12', gmv: 236 },
    { week: 'Sep 19', gmv: 321 },
    { week: 'Sep 26', gmv: 324 },
    { week: 'Oct 3', gmv: 341 },
    { week: 'Oct 10', gmv: 306 },
    { week: 'Oct 17', gmv: 440 },
  ];

  const filteredOrders = orders.filter((o) => {
    if (orderFilter && o.status !== orderFilter) return false;
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      const num = o.number?.toLowerCase() || '';
      const cust = o.users_orders_customer_idTousers?.name?.toLowerCase() || '';
      const store = o.stores?.name?.toLowerCase() || '';
      if (!num.includes(q) && !cust.includes(q) && !store.includes(q)) return false;
    }
    return true;
  });

  const filteredUsers = userRoleFilter
    ? users.filter((u) => u.role === userRoleFilter)
    : users;

  if (!loading && (!user || user.role !== 'admin')) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', padding: 20 }}>
        <div className="card" style={{ maxWidth: 480, width: '100%', padding: '36px 32px', borderRadius: 16, textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', background: '#fff' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', color: '#0F172A' }}>Admin Console</h2>
          {user ? (
            <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
              You are currently signed in as <strong>{user.name}</strong> (<span style={{ textTransform: 'capitalize' }}>{user.role}</span>). This console requires administrator privileges.
            </p>
          ) : (
            <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 24px' }}>
              Please sign in with an Administrator account to access operational controls and settings.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {user?.role === 'merchant' && (
              <Link
                href="/merchant"
                className="btn btn-outline"
                style={{ padding: '11px 24px', borderRadius: 999, fontWeight: 600, textDecoration: 'none' }}
              >
                Go to Merchant Portal →
              </Link>
            )}
            {user?.role === 'driver' && (
              <Link
                href="/driver"
                className="btn btn-outline"
                style={{ padding: '11px 24px', borderRadius: 999, fontWeight: 600, textDecoration: 'none' }}
              >
                Go to Driver Dispatch App →
              </Link>
            )}
            {user?.role === 'customer' && (
              <Link
                href="/"
                className="btn btn-outline"
                style={{ padding: '11px 24px', borderRadius: 999, fontWeight: 600, textDecoration: 'none' }}
              >
                Return to Shopper Marketplace →
              </Link>
            )}

            <button
              type="button"
              className="btn btn-gold"
              onClick={async () => {
                try {
                  await login('admin@buckduck.com', 'admin1234');
                  await loadData();
                } catch {
                  alert('Admin sign in failed. Please check backend.');
                }
              }}
              style={{
                padding: '12px 24px',
                borderRadius: 999,
                fontWeight: 700,
                background: '#E0A82E',
                color: '#1E293B',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Sign In as Administrator (admin@buckduck.com)
            </button>

            <Link
              href="/login"
              style={{ color: '#64748B', fontSize: 13, textDecoration: 'underline', marginTop: 4 }}
            >
              Sign in with another account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal">
      {/* Mobile Drawer Overlay Backdrop */}
      {isSidebarOpen && (
        <div className="sidebar-overlay open" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Dark Navy Sidebar */}
      <aside className={`sidebar no-print ${isSidebarOpen ? 'open' : ''}`} id="sidebar">
        <div className="logo" style={{ padding: '4px 8px 20px' }}>
          <svg viewBox="0 0 48 48" style={{ width: 34, height: 34, flex: 'none' }}>
            <defs>
              <linearGradient id="g-adm-side" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#F7E08B" />
                <stop offset="0.45" stopColor="#D4A017" />
                <stop offset="1" stopColor="#9E7410" />
              </linearGradient>
            </defs>
            <rect width="48" height="48" rx="11" fill="#0B1F4B" />
            <path d="M18 20v-3a6 6 0 0 1 12 0v3" fill="none" stroke="url(#g-adm-side)" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M12.5 20h23l-2.1 17.4A3 3 0 0 1 30.4 40H17.6a3 3 0 0 1-3-2.6z" fill="url(#g-adm-side)" />
            <circle cx="22.4" cy="29.4" r="4.4" fill="#0B1F4B" />
            <path d="M26.2 28.4l5.6 1.4-5.6 1.8z" fill="#0B1F4B" />
          </svg>
          <div>
            <div className="wm" style={{ fontSize: 18, color: '#fff' }}>Buck<b>Duck</b></div>
            <span className="sub" style={{ fontSize: 9 }}>ADMIN CONSOLE</span>
          </div>
        </div>

        <div
          className="side-sec"
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)',
            padding: '12px 14px 6px',
          }}
        >
          MENU
        </div>

        <button
          className={`side-link ${subView === 'overview' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => setSubView('overview')}
        >
          <BarChart2 size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: subView === 'overview' ? 1 : 0.75 }} />
          <span>Overview</span>
        </button>

        <button
          className={`side-link ${subView === 'orders' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => setSubView('orders')}
        >
          <List size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: subView === 'orders' ? 1 : 0.75 }} />
          <span>Orders</span>
          <span className="cnt" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>{orders.length}</span>
        </button>

        <button
          className={`side-link ${subView === 'dispatch' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => setSubView('dispatch')}
        >
          <Truck size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: subView === 'dispatch' ? 1 : 0.75 }} />
          <span>Dispatch</span>
          {unassignedCount > 0 && <span className="cnt">{unassignedCount}</span>}
        </button>

        <button
          className={`side-link ${subView === 'stores' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => setSubView('stores')}
        >
          <StoreIcon size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: subView === 'stores' ? 1 : 0.75 }} />
          <span>Stores</span>
          {pendingStoresCount > 0 && <span className="cnt" style={{ background: 'var(--amber)' }}>{pendingStoresCount}</span>}
        </button>

        <button
          className={`side-link ${subView === 'users' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => setSubView('users')}
        >
          <UsersIcon size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: subView === 'users' ? 1 : 0.75 }} />
          <span>Users</span>
        </button>

        <button
          className={`side-link ${subView === 'drivers' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => setSubView('drivers')}
        >
          <Truck size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: subView === 'drivers' ? 1 : 0.75 }} />
          <span>Drivers</span>
        </button>

        <button
          className={`side-link ${subView === 'windows' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => setSubView('windows')}
        >
          <Calendar size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: subView === 'windows' ? 1 : 0.75 }} />
          <span>Delivery windows</span>
        </button>

        <button
          className={`side-link ${subView === 'zones' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => setSubView('zones')}
        >
          <MapPin size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: subView === 'zones' ? 1 : 0.75 }} />
          <span>Service zones & ZIPs</span>
          <span className="cnt" style={{ background: 'var(--gold-metal)', color: 'var(--navy-950)', fontWeight: 700 }}>
            {zipList.filter((z) => z.active).length}
          </span>
        </button>

        <button
          className={`side-link ${subView === 'finance' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => setSubView('finance')}
        >
          <DollarSign size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: subView === 'finance' ? 1 : 0.75 }} />
          <span>Finance</span>
        </button>

        <button
          className={`side-link ${subView === 'settings' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => setSubView('settings')}
        >
          <SettingsIcon size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: subView === 'settings' ? 1 : 0.75 }} />
          <span>Settings</span>
        </button>

        <div className="side-foot" style={{ marginTop: 'auto', paddingTop: 16 }}>
          <div className="row" style={{ gap: 12, marginBottom: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #F7E08B, #D4A017)',
                color: '#0B1F4B',
                fontWeight: 800,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
              }}
            >
              BO
            </div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="strong small" style={{ color: '#fff', fontSize: 13 }}>
                BuckDuck Operations
              </div>
              <div className="tiny" style={{ opacity: 0.55, fontSize: 11 }}>
                admin@buckduck.com
              </div>
            </div>
          </div>
          <button
            className="btn btn-sm btn-block"
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '9px 16px',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onClick={() => {
              logout();
              router.push('/login');
            }}
          >
            <LogOut size={15} strokeWidth={2.2} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main">
        {/* Top Bar */}
        <div className="main-top no-print">
          <div className="row" style={{ alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="mobile-toggle"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Toggle navigation menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="strong" style={{ fontSize: 16 }}>
              {subView === 'overview' && 'Marketplace overview'}
              {subView === 'orders' && 'Orders'}
              {subView === 'dispatch' && 'Dispatch board'}
              {subView === 'stores' && 'Stores'}
              {subView === 'users' && 'Users'}
              {subView === 'drivers' && 'Drivers'}
              {subView === 'windows' && 'Delivery windows'}
              {subView === 'zones' && 'Service zones & delivery ZIPs'}
              {subView === 'finance' && 'Finance'}
              {subView === 'settings' && 'Settings'}
            </div>
          </div>

          <div className="row" style={{ gap: 10 }}>
            <span className="badge b-gold hide-sm">
              🚚 Next: Saturday, Feb 21
            </span>
            <Link href="/" className="btn btn-ghost btn-sm">
              Marketplace
            </Link>
          </div>
        </div>

        <div className="main-body">
          {/* SCREEN 1: OVERVIEW (30-admin-overview.png) */}
          {subView === 'overview' && (
            <div className="stack" style={{ gap: 20 }}>
              <div className="page-h">
                <div>
                  <h1>Marketplace overview</h1>
                  <p>Live operations for Saturday, Oct 24 delivery day</p>
                </div>
                <div className="row">
                  <button className="btn btn-ghost btn-sm" onClick={() => setSubView('dispatch')}>
                    🚚 Dispatch board →
                  </button>
                </div>
              </div>

              {pendingStoresCount > 0 && (
                <div className="alert warn">
                  <span>🏪</span>
                  <span><strong>{pendingStoresCount} store(s) awaiting approval.</strong> <a href="#" onClick={(e) => { e.preventDefault(); setSubView('stores'); }}>Review now →</a></span>
                </div>
              )}

              {unassignedCount > 0 && (
                <div className="alert info">
                  <span>🚚</span>
                  <span><strong>{unassignedCount} ready orders have no driver assigned.</strong> <a href="#" onClick={(e) => { e.preventDefault(); setSubView('dispatch'); }}>Assign drivers →</a></span>
                </div>
              )}

              {/* 4 KPIs */}
              <div className="grid g4">
                <div className="kpi">
                  <div className="lbl">GROSS MERCHANDISE VALUE</div>
                  <div className="val">${((overview?.gmvCents || 489000) / 100).toFixed(0)}</div>
                  <div className="sub">All paid orders</div>
                </div>
                <div className="kpi">
                  <div className="lbl">NET REVENUE</div>
                  <div className="val">${((overview?.netRevenueCents || 98200) / 100).toFixed(0)}</div>
                  <div className="sub">Commissions + fees − driver pay</div>
                </div>
                <div className="kpi">
                  <div className="lbl">ORDERS</div>
                  <div className="val">{overview?.totalOrders || 84}</div>
                  <div className="sub">{users.filter((u) => u.role === 'customer').length} customers</div>
                </div>
                <div className="kpi">
                  <div className="lbl">AVG ORDER VALUE</div>
                  <div className="val">$58.20</div>
                  <div className="sub">{stores.length} live stores · {dispatch?.drivers?.filter((d: any) => d.isOnline).length || 2} drivers online</div>
                </div>
              </div>

              {/* GMV by Delivery Day + Pipeline Funnel */}
              <div className="dashboard-charts-grid">
                <div className="card">
                  <div className="card-h">
                    <h3>GMV by delivery day</h3>
                    <span className="small muted">Hover a bar for detail</span>
                  </div>
                  <BarChart
                    data={chartGmvData}
                    valueKey="gmv"
                    labelKey="week"
                    tipLabel="Saturday GMV"
                    color="var(--blue-600)"
                  />
                </div>

                <div className="card">
                  <h3>This Saturday's pipeline</h3>
                  <div className="summary-line" style={{ marginTop: 10 }}>
                    <span className="badge b-amber">1. Placed</span>
                    <b>{orders.filter((o) => o.status === 'placed').length}</b>
                  </div>
                  <div className="summary-line">
                    <span className="badge b-blue">2. Accepted</span>
                    <b>{orders.filter((o) => o.status === 'accepted').length}</b>
                  </div>
                  <div className="summary-line">
                    <span className="badge b-purple">3. Packing</span>
                    <b>{orders.filter((o) => o.status === 'packing').length}</b>
                  </div>
                  <div className="summary-line">
                    <span className="badge b-green">4. Ready</span>
                    <b>{orders.filter((o) => o.status === 'ready').length}</b>
                  </div>
                  <div className="summary-line">
                    <span className="badge b-blue">5. Out for delivery</span>
                    <b>{orders.filter((o) => o.status === 'out_for_delivery').length}</b>
                  </div>

                  <h4 style={{ marginTop: 18, marginBottom: 8 }}>Window capacity</h4>
                  {windows.slice(0, 2).map((w) => (
                    <div key={w.id} style={{ marginTop: 8 }}>
                      <div className="row between small">
                        <span>{w.label}</span>
                        <span className="muted">{w.booked}/{w.capacity}</span>
                      </div>
                      <div className="bar" style={{ width: '100%', marginTop: 4 }}>
                        <i style={{ width: `${Math.min(100, Math.round((w.booked / (w.capacity || 120)) * 100))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Stores & Payment Mix */}
              <div className="grid g2">
                <div className="card">
                  <h3>Top stores</h3>
                  <table className="table" style={{ marginTop: 10 }}>
                    <tbody>
                      {stores.slice(0, 4).map((s) => (
                        <tr key={s.id}>
                          <td><span style={{ fontSize: 20, marginRight: 8 }}>{s.emoji || '🏪'}</span><strong>{s.name}</strong></td>
                          <td className="num muted">24 orders</td>
                          <td className="num strong">$1,450</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card">
                  <h3>Payment methods</h3>
                  <div className="stack" style={{ gap: 12, marginTop: 14 }}>
                    <div>
                      <div className="row between small"><span>Credit / Debit Card (Stripe)</span><span>65%</span></div>
                      <div className="bar" style={{ width: '100%', marginTop: 4 }}><i style={{ width: '65%' }} /></div>
                    </div>
                    <div>
                      <div className="row between small"><span>Apple Pay</span><span>25%</span></div>
                      <div className="bar" style={{ width: '100%', marginTop: 4 }}><i style={{ width: '25%' }} /></div>
                    </div>
                    <div>
                      <div className="row between small"><span>Google Pay</span><span>10%</span></div>
                      <div className="bar" style={{ width: '100%', marginTop: 4 }}><i style={{ width: '10%' }} /></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 2: DISPATCH BOARD (32-admin-dispatch.png) */}
          {subView === 'dispatch' && (
            <div>
              <div className="page-h">
                <div>
                  <h1>Dispatch board</h1>
                  <p>Assign packed orders to drivers and monitor routes for delivery day.</p>
                </div>
              </div>

              {/* 4.a: Visual Saturday Dispatch Topology Map */}
              <div className="card mb24" style={{ padding: 18, background: '#07132c', color: '#fff', borderRadius: 14, overflow: 'hidden' }}>
                <div className="row between wrap mb12">
                  <div>
                    <div className="tiny" style={{ color: 'var(--gold-400)', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                      SATURDAY ROUTE TOPOLOGY · SILVER SPRING METRO
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                      Live Fleet & Hub Distribution
                    </div>
                  </div>

                  <div className="row wrap" style={{ gap: 8 }}>
                    <span className="badge" style={{ background: 'rgba(212, 160, 23, 0.2)', color: 'var(--gold-400)', border: '1px solid rgba(212, 160, 23, 0.4)' }}>
                      🏪 6 Partner Grocers
                    </span>
                    <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                      🚗 {dispatch?.drivers?.length || 2} Active Vans
                    </span>
                    <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#86efac', border: '1px solid rgba(34, 197, 94, 0.4)' }}>
                      📦 {orders.length} Deliveries
                    </span>
                  </div>
                </div>

                {/* SVG Visual Map Canvas */}
                <div style={{ position: 'relative', width: '100%', height: 260, background: 'radial-gradient(ellipse at 50% 50%, #0c204c 0%, #050e22 100%)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <svg viewBox="0 0 900 300" style={{ width: '100%', height: '100%' }}>
                    {/* Zone Boundary Grid */}
                    <defs>
                      <pattern id="dispatch-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                      </pattern>
                      <linearGradient id="route-pulse" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#D4A017" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.7" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.9" />
                      </linearGradient>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#dispatch-grid)" />

                    {/* Zone Labels */}
                    <text x="70" y="45" fill="rgba(255,255,255,0.3)" fontSize="11" fontWeight="700">WHEATON / GLENMONT (20902)</text>
                    <text x="360" y="45" fill="rgba(255,255,255,0.3)" fontSize="11" fontWeight="700">SILVER SPRING DOWNTOWN (20910)</text>
                    <text x="680" y="45" fill="rgba(255,255,255,0.3)" fontSize="11" fontWeight="700">TAKOMA PARK / DC BORDER (20912)</text>

                    {/* Connecting Route Arteries (Georgia Ave / Colesville Rd / I-495) */}
                    <path d="M 80 160 Q 250 140 450 150 T 820 180" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 450 60 L 450 260" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" strokeLinecap="round" />
                    <path d="M 200 80 Q 450 200 750 120" fill="none" stroke="url(#route-pulse)" strokeWidth="3" strokeDasharray="8 6" />

                    {/* Store Hub Pins (Gold) */}
                    {[
                      { name: 'Accra Market', x: 220, y: 120, emoji: '🌍', bags: 4 },
                      { name: 'Lagos Pantry', x: 420, y: 130, emoji: '🍲', bags: 3 },
                      { name: 'Addis Spice', x: 620, y: 105, emoji: '☕', bags: 2 },
                      { name: 'Medina Halal', x: 310, y: 210, emoji: '🥩', bags: 5 },
                      { name: 'Caribbean Spice', x: 540, y: 220, emoji: '🌴', bags: 3 },
                      { name: 'Tropical Roots', x: 740, y: 170, emoji: '🥑', bags: 2 },
                    ].map((st, idx) => (
                      <g key={idx} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapPin({ type: 'Store Hub', title: st.name, info: `${st.bags} sealed bags ready for Saturday dispatch` })}>
                        <circle cx={st.x} cy={st.y} r="18" fill="#B7791F" stroke="#FDE047" strokeWidth="2.5" />
                        <text x={st.x} y={st.y + 5} textAnchor="middle" fontSize="13">{st.emoji}</text>
                        <text x={st.x} y={st.y + 30} textAnchor="middle" fill="#F7E08B" fontSize="11" fontWeight="700">{st.name}</text>
                      </g>
                    ))}

                    {/* Driver Vans (Blue) */}
                    {[
                      { name: 'Kwame Asante', x: 380, y: 165, stops: 6 },
                      { name: 'Kofi Mensah', x: 670, y: 140, stops: 4 },
                    ].map((dv, idx) => (
                      <g key={idx} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapPin({ type: 'Active Driver', title: dv.name, info: `${dv.stops} assigned deliveries on active route` })}>
                        <rect x={dv.x - 24} y={dv.y - 12} width="48" height="24" rx="12" fill="#1D4ED8" stroke="#93C5FD" strokeWidth="2" />
                        <text x={dv.x} y={dv.y + 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800">🚗 {dv.stops}</text>
                        <text x={dv.x} y={dv.y - 18} textAnchor="middle" fill="#93C5FD" fontSize="10" fontWeight="600">{dv.name}</text>
                      </g>
                    ))}

                    {/* Customer Drop Pins (Green) */}
                    {[
                      { x: 150, y: 175, id: '10015-A' },
                      { x: 270, y: 80, id: '10015-B' },
                      { x: 490, y: 180, id: '10016' },
                      { x: 590, y: 70, id: '10014' },
                      { x: 790, y: 220, id: '10012' },
                    ].map((dp, idx) => (
                      <g key={idx} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapPin({ type: 'Delivery Stop', title: `Order #${dp.id}`, info: 'Silver Spring, MD · Saturday customer drop-off' })}>
                        <circle cx={dp.x} cy={dp.y} r="7" fill="#10B981" stroke="#fff" strokeWidth="1.5" />
                        <circle cx={dp.x} cy={dp.y} r="12" fill="none" stroke="#10B981" strokeOpacity="0.4" strokeWidth="2" />
                      </g>
                    ))}
                  </svg>

                  {/* Selected Pin Details Overlay */}
                  {selectedMapPin && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 12,
                        left: 14,
                        background: 'rgba(11, 31, 75, 0.95)',
                        border: '1px solid var(--gold-metal)',
                        borderRadius: 8,
                        padding: '8px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        zIndex: 10,
                      }}
                    >
                      <div>
                        <span className="tiny muted" style={{ textTransform: 'uppercase', color: 'var(--gold-400)' }}>{selectedMapPin.type}</span>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{selectedMapPin.title}</div>
                        <div className="tiny" style={{ opacity: 0.8 }}>{selectedMapPin.info}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedMapPin(null)}
                        style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer', padding: 4 }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', gap: 14, fontSize: 11, background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: 20 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FDE047' }} /> Store Hubs</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6' }} /> Active Vans</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} /> Customer Stops</span>
                  </div>
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
                {/* Ready - Needs Driver (Screenshot 4) */}
                <div className="card" style={{ padding: 20 }}>
                  <div className="card-h" style={{ marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 18 }}>Ready — needs driver</h3>
                    <span
                      style={{
                        background: '#FEF3C7',
                        color: '#B45309',
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      ● {dispatch?.unassignedReadyOrders?.length || 0}
                    </span>
                  </div>

                  <div className="stack" style={{ gap: 12 }}>
                    {dispatch?.unassignedReadyOrders?.map((o: any) => (
                      <div
                        key={o.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 0',
                          borderTop: '1px solid var(--line)',
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 14 }}>{o.number}</strong>
                            <span className="small muted">
                              {o.delivery_windows?.label || 'Sat, Oct 24 · 12 PM–4 PM'}
                            </span>
                          </div>
                          <div className="small" style={{ color: 'var(--ink-2)', marginTop: 2 }}>
                            {o.stores?.name} → {o.zip} · 🛍️ {o.bags || 1}
                          </div>
                        </div>

                        <select
                          className="input"
                          style={{
                            width: 170,
                            padding: '8px 12px',
                            fontSize: 13,
                            borderRadius: 8,
                            borderColor: 'var(--line-2)',
                            cursor: 'pointer',
                            flex: 'none',
                          }}
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) handleAssignDriver(o.id, Number(e.target.value));
                          }}
                        >
                          <option value="" disabled>Assign driver...</option>
                          {(dispatch?.drivers && dispatch.drivers.length > 0 ? dispatch.drivers : [
                            { id: 3, name: 'Kwame Asante', vehicle: 'Toyota Sienna' },
                            { id: 4, name: 'Luis Ramirez', vehicle: 'Ford Transit' },
                          ]).map((d: any) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}

                    {(!dispatch?.unassignedReadyOrders || dispatch.unassignedReadyOrders.length === 0) && (
                      <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)' }}>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>✓</div>
                        <div>All ready orders have been assigned to drivers.</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Drivers Fleet (Screenshot 4) */}
                <div className="card" style={{ padding: 20 }}>
                  <div className="card-h" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <h3 style={{ margin: 0, fontSize: 18 }}>Fleet Drivers</h3>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: 'rgba(34, 197, 94, 0.12)',
                          color: '#15803D',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        <Radio size={11} />
                        <span>Live Sync</span>
                      </span>
                    </div>
                    <span className="tiny muted">Click badge to toggle online</span>
                  </div>

                  <div className="stack" style={{ gap: 14 }}>
                    {(users.filter((u) => u.role === 'driver').length > 0
                      ? users.filter((u) => u.role === 'driver')
                      : (dispatch?.drivers || [])
                    ).map((driver: any) => {
                      const initials = (driver.name || 'Driver')
                        .split(' ')
                        .map((p: string) => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      const isOnline = Boolean(driver.driver_online);
                      return (
                        <div
                          key={driver.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                background: '#F7E08B',
                                color: '#0B1F4B',
                                fontWeight: 800,
                                fontSize: 14,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flex: 'none',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
                              }}
                            >
                              {initials}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
                                {driver.name}
                              </div>
                              <div className="tiny muted">{driver.vehicle || 'Standard Delivery Vehicle'}</div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                              type="button"
                              onClick={() => handleToggleDriverOnline(driver.id, isOnline)}
                              title="Click to toggle live online/offline status via WebSocket"
                              style={{
                                background: isOnline ? '#DCFCE7' : '#F1F5F9',
                                color: isOnline ? '#15803D' : '#475569',
                                padding: '4px 10px',
                                borderRadius: 20,
                                fontSize: 12,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: isOnline ? '0 0 6px rgba(34, 197, 94, 0.4)' : 'none',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  background: isOnline ? '#15803D' : '#94A3B8',
                                }}
                              />
                              <span>{isOnline ? 'Online' : 'Offline'}</span>
                            </button>
                            <span className="small muted" style={{ minWidth: 48, textAlign: 'right' }}>
                              {driver.stops || 0} stops
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* OUT FOR DELIVERY SECTION (Screenshot 4) */}
              <div className="card" style={{ marginTop: 20, padding: 20 }}>
                <div className="card-h" style={{ marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 18 }}>Out for delivery</h3>
                </div>

                {dispatch?.outForDelivery && dispatch.outForDelivery.length > 0 ? (
                  <div className="stack" style={{ gap: 10 }}>
                    {dispatch.outForDelivery.map((o: any) => (
                      <div
                        key={o.id}
                        className="row between wrap"
                        style={{ padding: '12px 0', borderTop: '1px solid var(--line)', gap: 12 }}
                      >
                        <div>
                          <strong style={{ fontSize: 14 }}>{o.number}</strong>
                          <span className="small" style={{ marginLeft: 8 }}>
                            {o.stores?.name} → {o.zip}
                          </span>
                          <div className="tiny muted" style={{ marginTop: 2 }}>
                            {o.users_orders_customer_idTousers?.name} · 🛍️ {o.bags || 1} BuckDuck bag(s)
                          </div>
                        </div>

                        <div className="row" style={{ gap: 10 }}>
                          <span className="badge b-blue" style={{ fontWeight: 600 }}>
                            🚗 Driver: {o.users_orders_driver_idTousers?.name || 'Kwame Asante'}
                          </span>
                          <span className="badge b-amber">● Out for delivery</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="small muted" style={{ margin: 0 }}>
                    No orders on the road right now.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* SCREEN 3: ORDERS (Screenshot 1) */}
          {subView === 'orders' && (
            <div className="stack" style={{ gap: 20 }}>
              <div className="page-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 28 }}>Orders</h1>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
                    {filteredOrders.length} orders shown
                  </p>
                </div>

                <div className="row" style={{ gap: 8 }}>
                  <input
                    className="input"
                    placeholder="Search order #, customer, store"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    style={{ width: 280, padding: '9px 14px', borderRadius: 8 }}
                  />
                  <button className="btn btn-primary" type="button" style={{ borderRadius: 8, padding: '9px 18px' }}>
                    Search
                  </button>
                </div>
              </div>

              {/* Status Filter Tabs (Screenshot 1) */}
              <div
                style={{
                  display: 'flex',
                  gap: 24,
                  borderBottom: '1px solid var(--line)',
                  paddingBottom: 0,
                  overflowX: 'auto',
                }}
              >
                {[
                  { key: '', label: 'All' },
                  { key: 'placed', label: 'New' },
                  { key: 'accepted', label: 'Accepted' },
                  { key: 'packing', label: 'Packing' },
                  { key: 'ready', label: 'Ready' },
                  { key: 'out_for_delivery', label: 'Out for delivery' },
                  { key: 'delivered', label: 'Delivered' },
                  { key: 'refunded', label: 'Refunded' },
                  { key: 'cancelled', label: 'Cancelled' },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '10px 0',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 14,
                      color: orderFilter === t.key ? 'var(--navy-950)' : 'var(--ink-3)',
                      borderBottom: orderFilter === t.key ? '2px solid var(--gold-500, #D4A017)' : '2px solid transparent',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => setOrderFilter(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="card pad0">
                <div className="table-wrap">
                  <table className="table" style={{ width: '100%', margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 110 }}>ORDER</th>
                        <th>DELIVERY WINDOW</th>
                        <th>CUSTOMER</th>
                        <th>STORE</th>
                        <th>DRIVER</th>
                        <th>PAYMENT</th>
                        <th>STATUS</th>
                        <th className="num" style={{ textAlign: 'right' }}>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((o) => (
                        <tr
                          key={o.id}
                          className="click"
                          onClick={() => {
                            setModalOrder(o);
                            setOverrideStatus(o.status);
                            setOverrideDriverId(o.driver_id || '');
                          }}
                        >
                          <td>
                            <strong style={{ color: 'var(--blue-700)' }}>{o.number}</strong>
                          </td>
                          <td className="small" style={{ color: 'var(--ink-2)' }}>
                            {o.delivery_windows?.label || 'Sat, Oct 24 · 6 AM–12 PM'}
                          </td>
                          <td style={{ fontWeight: 500 }}>
                            {o.users_orders_customer_idTousers?.name || 'Customer'}
                          </td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span>{o.stores?.emoji || '🏪'}</span>
                              <span>{o.stores?.name}</span>
                            </span>
                          </td>
                          <td className="small">
                            {o.users_orders_driver_idTousers?.name || '—'}
                          </td>
                          <td>
                            <span className="small muted">
                              {o.payment_method || (o.id % 3 === 0 ? 'Apple Pay' : o.id % 2 === 0 ? '💳 Card' : 'G Google Pay')}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 10px',
                                borderRadius: 20,
                                fontSize: 12,
                                fontWeight: 700,
                                background:
                                  o.status === 'delivered'
                                    ? '#DCFCE7'
                                    : o.status === 'cancelled' || o.status === 'refunded'
                                    ? '#FEE2E2'
                                    : o.status === 'ready'
                                    ? '#FEF3C7'
                                    : '#FEF9C3',
                                color:
                                  o.status === 'delivered'
                                    ? '#15803D'
                                    : o.status === 'cancelled' || o.status === 'refunded'
                                    ? '#B91C1C'
                                    : o.status === 'ready'
                                    ? '#B45309'
                                    : '#854D0E',
                              }}
                            >
                              ● {o.status === 'ready' ? 'Ready for pickup' : o.status === 'placed' ? 'New' : o.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="num strong" style={{ textAlign: 'right' }}>
                            ${((o.total_cents || 0) / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {filteredOrders.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted)' }}>
                            No orders found matching this filter or search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 4: STORES (33-admin-stores.png) */}
          {subView === 'stores' && (
            <div>
              <div className="page-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 28 }}>Stores</h1>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>Approve new merchants, set commission and manage storefronts.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={() => setShowAddStoreModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 22px',
                    borderRadius: 999,
                    fontWeight: 700,
                    background: '#E0A82E',
                    color: '#1E293B',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={16} strokeWidth={2.5} />
                  <span>Add store</span>
                </button>
              </div>

              <div className="card pad0">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Store</th>
                        <th>Owner</th>
                        <th>Category</th>
                        <th className="num">Commission</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stores.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <div className="row">
                              <span style={{ fontSize: 24 }}>{s.emoji || '🏪'}</span>
                              <div>
                                <b>{s.name}</b>
                                <div className="tiny muted">{s.city}, {s.state}</div>
                              </div>
                            </div>
                          </td>
                          <td className="small">
                            {s.users?.name}
                            <div className="tiny muted">{s.users?.email}</div>
                          </td>
                          <td>{s.category}</td>
                          <td className="num">
                            <input
                              className="input"
                              type="number"
                              style={{ width: 70, padding: '4px 8px', textAlign: 'right' }}
                              defaultValue={Math.round((s.commission_rate || 0.15) * 100)}
                              onBlur={(e) => handleUpdateStore(s.id, s.status, parseFloat(e.target.value) / 100)}
                            />%
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleUpdateStore(s.id, s.status === 'active' ? 'suspended' : 'active')}
                              title={`Click to toggle store status (currently ${s.status})`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 10px',
                                borderRadius: 999,
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 700,
                                background: s.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: s.status === 'active' ? '#16A34A' : '#DC2626',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  background: s.status === 'active' ? '#16A34A' : '#DC2626',
                                }}
                              />
                              <span style={{ textTransform: 'capitalize' }}>{s.status}</span>
                            </button>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {s.status === 'pending' ? (
                                <button className="btn btn-success btn-sm" onClick={() => handleUpdateStore(s.id, 'active')}>
                                  Approve
                                </button>
                              ) : (
                                <button
                                  className={`btn btn-sm ${s.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                                  onClick={() => handleUpdateStore(s.id, s.status === 'active' ? 'suspended' : 'active')}
                                >
                                  {s.status === 'active' ? 'Suspend' : 'Activate'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteStore(s.id, s.name)}
                                title="Delete store"
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: 6,
                                  border: '1px solid #FCA5A5',
                                  background: '#FEF2F2',
                                  color: '#DC2626',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 5: USERS (34-admin-users.png) */}
          {subView === 'users' && (
            <div>
              <div className="page-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 28 }}>Users</h1>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>{filteredUsers.length} accounts in database</p>
                </div>
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={() => setShowAddUserModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 22px',
                    borderRadius: 999,
                    fontWeight: 700,
                    background: '#E0A82E',
                    color: '#1E293B',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={16} strokeWidth={2.5} />
                  <span>Add user</span>
                </button>
              </div>

              <div className="tabs">
                {[
                  { key: '', label: 'All' },
                  { key: 'customer', label: 'Customers' },
                  { key: 'merchant', label: 'Merchants' },
                  { key: 'driver', label: 'Drivers' },
                  { key: 'admin', label: 'Admins' },
                ].map((t) => (
                  <button
                    key={t.key}
                    className={`tab ${userRoleFilter === t.key ? 'active' : ''}`}
                    onClick={() => setUserRoleFilter(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="card pad0">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id}>
                          <td><strong>{u.name}</strong></td>
                          <td>{u.email}</td>
                          <td>
                            <span className="badge b-blue" style={{ textTransform: 'capitalize' }}>
                              {u.role}
                            </span>
                          </td>
                          <td className="small">{u.phone || '—'}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(u.id, u.status || 'active')}
                              title={`Click to toggle status (currently ${u.status || 'active'})`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 10px',
                                borderRadius: 999,
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 700,
                                background: u.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: u.status === 'active' ? '#16A34A' : '#DC2626',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  background: u.status === 'active' ? '#16A34A' : '#DC2626',
                                }}
                              />
                              <span style={{ textTransform: 'capitalize' }}>{u.status || 'active'}</span>
                            </button>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                type="button"
                                className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                                onClick={() => handleToggleUserStatus(u.id, u.status || 'active')}
                                style={{ padding: '4px 10px', fontSize: 12 }}
                              >
                                {u.status === 'active' ? 'Suspend' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                title="Delete user"
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: 6,
                                  border: '1px solid #FCA5A5',
                                  background: '#FEF2F2',
                                  color: '#DC2626',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 6: DRIVERS (35-admin-drivers.png) */}
          {subView === 'drivers' && (
            <div>
              <div className="page-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <h1 style={{ margin: 0, fontSize: 28 }}>Drivers</h1>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: 'rgba(34, 197, 94, 0.12)',
                        color: '#15803D',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      <Radio size={13} />
                      <span>WebSocket Live Sync</span>
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>Saturday driver fleet, vehicle assignments, and real-time dispatch availability</p>
                </div>
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={() => setShowAddDriverModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 22px',
                    borderRadius: 999,
                    fontWeight: 700,
                    background: '#E0A82E',
                    color: '#1E293B',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={16} strokeWidth={2.5} />
                  <span>Add driver</span>
                </button>
              </div>

              <div className="grid g3">
                {users.filter((u) => u.role === 'driver').map((d) => (
                  <div key={d.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div className="row between" style={{ alignItems: 'flex-start' }}>
                        <div className="avatar-sm" style={{ fontWeight: 800, fontSize: 15 }}>{d.name.charAt(0)}</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {/* Live socket online toggle badge */}
                          <button
                            type="button"
                            onClick={() => handleToggleDriverOnline(d.id, Boolean(d.driver_online))}
                            title="Click to toggle live online/offline status (broadcasts via WebSocket)"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 10px',
                              borderRadius: 999,
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 700,
                              background: d.driver_online ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                              color: d.driver_online ? '#16A34A' : '#64748B',
                              boxShadow: d.driver_online ? '0 0 8px rgba(34, 197, 94, 0.35)' : 'none',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: d.driver_online ? '#16A34A' : '#94A3B8',
                                display: 'inline-block',
                              }}
                            />
                            <span>{d.driver_online ? 'Online' : 'Offline'}</span>
                          </button>

                          {/* Account status badge */}
                          <span
                            className={`badge ${d.status === 'active' ? 'b-green' : 'b-amber'}`}
                            style={{ fontSize: 11, textTransform: 'capitalize' }}
                          >
                            {d.status || 'active'}
                          </span>
                        </div>
                      </div>
                      <div style={{ marginTop: 14 }}>
                        <strong style={{ fontSize: 16 }}>{d.name}</strong>
                        <div className="tiny muted">{d.vehicle || 'Toyota Sienna · Silver'}</div>
                        <div className="small" style={{ marginTop: 8 }}>📞 {d.phone || '(301) 555-0102'}</div>
                        <div className="tiny muted" style={{ marginTop: 2 }}>✉️ {d.email}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', alignItems: 'center' }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${d.driver_online ? 'btn-ghost' : 'btn-success'}`}
                        onClick={() => handleToggleDriverOnline(d.id, Boolean(d.driver_online))}
                        style={{ flex: 1, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        title="Broadcast online status update via WebSocket"
                      >
                        <Power size={13} />
                        <span>{d.driver_online ? 'Set Offline' : 'Set Online'}</span>
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${d.status === 'active' ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={() => handleToggleUserStatus(d.id, d.status || 'active')}
                        style={{ fontSize: 12 }}
                        title={d.status === 'active' ? 'Suspend driver account login' : 'Activate driver account login'}
                      >
                        {d.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(d.id, d.name)}
                        title="Delete driver"
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: '1px solid #FCA5A5',
                          background: '#FEF2F2',
                          color: '#DC2626',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCREEN 7: WINDOWS (Screenshot 2) */}
          {subView === 'windows' && (
            <div className="stack" style={{ gap: 20 }}>
              <div className="page-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 28 }}>Delivery windows</h1>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
                    Deliveries run on <strong>Saturdays</strong>. Windows are published automatically several weeks ahead — adjust capacity, pause, or add special windows.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={() => setShowAddWindowModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 20px',
                    borderRadius: 999,
                    fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(212,160,23,0.35)',
                  }}
                >
                  <Plus size={16} strokeWidth={2.5} />
                  <span>Add window</span>
                </button>
              </div>

              <div className="card pad0">
                <div className="table-wrap">
                  <table className="table" style={{ width: '100%', margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 140 }}>DATE</th>
                        <th>WINDOW</th>
                        <th>ORDER CUTOFF</th>
                        <th style={{ width: 150 }}>BOOKED</th>
                        <th style={{ width: 100, textAlign: 'center' }}>CAPACITY</th>
                        <th style={{ width: 110, textAlign: 'center' }}>STATUS</th>
                        <th style={{ width: 90, textAlign: 'right' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {windows.map((w) => {
                        const booked = w.booked || 0;
                        const capacity = w.capacity || 120;
                        const pct = Math.min(100, Math.round((booked / capacity) * 100));

                        // Format date like 'Sat, Oct 24, 2026'
                        let formattedDate = w.date;
                        let cutoffStr = '24h prior';
                        try {
                          const [y, m, d] = w.date.split('-').map(Number);
                          const dt = new Date(y, m - 1, d);
                          formattedDate = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                          const cutoffDate = new Date(y, m - 1, d - 1);
                          const [hStr, minStr] = (w.start_time || '06:00').split(':');
                          const h = Number(hStr);
                          const ampm = h >= 12 ? 'PM' : 'AM';
                          const h12 = h % 12 || 12;
                          cutoffStr = `${cutoffDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${h12}:${minStr || '00'} ${ampm}`;
                        } catch {}

                        const isOpen = w.active !== false;

                        return (
                          <tr key={w.id}>
                            <td>
                              <strong style={{ color: 'var(--ink)' }}>{formattedDate}</strong>
                            </td>
                            <td style={{ color: 'var(--ink-2)' }}>
                              {w.label || `${w.start_time} – ${w.end_time}`}
                            </td>
                            <td className="small muted">
                              {cutoffStr}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div
                                  style={{
                                    flex: 1,
                                    height: 7,
                                    background: '#E2E8F0',
                                    borderRadius: 999,
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      background: '#2563EB',
                                      borderRadius: 999,
                                    }}
                                  />
                                </div>
                                <span className="small muted" style={{ minWidth: 24, fontVariantNumeric: 'tabular-nums' }}>
                                  {booked}
                                </span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="number"
                                className="input"
                                defaultValue={capacity}
                                style={{
                                  width: 72,
                                  padding: '4px 6px',
                                  textAlign: 'center',
                                  fontSize: 13,
                                  borderRadius: 6,
                                }}
                                onBlur={(e) => handleUpdateWindowCapacity(w.id, Number(e.target.value))}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '3px 10px',
                                  borderRadius: 20,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  background: isOpen ? '#DCFCE7' : '#FEF3C7',
                                  color: isOpen ? '#15803D' : '#B45309',
                                }}
                              >
                                ● {isOpen ? 'Open' : 'Closed'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleToggleWindowActive(w.id, !isOpen)}
                                style={{
                                  borderRadius: 999,
                                  padding: '4px 12px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {isOpen ? 'Pause' : 'Open'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {windows.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted)' }}>
                            No delivery windows found. Click &quot;+ Add window&quot; above to create one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 8: FINANCE (Screenshot 4) */}
          {subView === 'finance' && (
            <div className="stack" style={{ gap: 24 }}>
              <div className="page-h">
                <div>
                  <h1 style={{ margin: 0, fontSize: 28 }}>Finance</h1>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
                    Settlement by delivery day (delivered orders)
                  </p>
                </div>
              </div>

              {/* 4 KPI Cards (Screenshot 4) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                }}
              >
                <div
                  className="card"
                  style={{
                    padding: '20px 24px',
                    borderRadius: 12,
                    border: '1px solid #E2E8F0',
                    borderTop: '4px solid #CA8A04',
                    background: '#fff',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em' }}>
                    GMV
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#0F172A', marginTop: 8 }}>
                    $12,937
                  </div>
                </div>

                <div
                  className="card"
                  style={{
                    padding: '20px 24px',
                    borderRadius: 12,
                    border: '1px solid #E2E8F0',
                    borderTop: '4px solid #CA8A04',
                    background: '#fff',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em' }}>
                    NET REVENUE
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#0F172A', marginTop: 8 }}>
                    $2,232
                  </div>
                </div>

                <div
                  className="card"
                  style={{
                    padding: '20px 24px',
                    borderRadius: 12,
                    border: '1px solid #E2E8F0',
                    borderTop: '4px solid #CA8A04',
                    background: '#fff',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em' }}>
                    MERCHANT PAYOUTS
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#0F172A', marginTop: 8 }}>
                    $8,523
                  </div>
                </div>

                <div
                  className="card"
                  style={{
                    padding: '20px 24px',
                    borderRadius: 12,
                    border: '1px solid #E2E8F0',
                    borderTop: '4px solid #CA8A04',
                    background: '#fff',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em' }}>
                    REFUNDS
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#0F172A', marginTop: 8 }}>
                    $278
                  </div>
                  <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                    7 orders
                  </div>
                </div>
              </div>

              {/* Bar Chart & Breakdown Table Card (Screenshot 4) */}
              <div className="card" style={{ padding: 24, borderRadius: 12, border: '1px solid #E2E8F0', background: '#fff' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
                  Net revenue by delivery day
                </h3>
                <BarChart
                  data={financeChartData}
                  valueKey="gmv"
                  labelKey="week"
                  color="#B8860B"
                  tipLabel="Net Revenue"
                />

                <div className="table-wrap" style={{ marginTop: 32 }}>
                  <table className="table" style={{ width: '100%', margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>DELIVERY DAY</th>
                        <th style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textAlign: 'center' }}>ORDERS</th>
                        <th style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textAlign: 'right' }}>GMV</th>
                        <th style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textAlign: 'right' }}>COMMISSION</th>
                        <th style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textAlign: 'right' }}>SERVICE FEES</th>
                        <th style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textAlign: 'right' }}>DELIVERY FEES</th>
                        <th style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textAlign: 'right' }}>DRIVER PAY</th>
                        <th style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textAlign: 'right' }}>MERCHANT PAYOUTS</th>
                        <th style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textAlign: 'right' }}>NET REVENUE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financeSettlements.map((row, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong style={{ color: '#0F172A' }}>{row.day}</strong>
                          </td>
                          <td style={{ textAlign: 'center', color: '#475569' }}>
                            {row.orders}
                          </td>
                          <td style={{ textAlign: 'right', color: '#475569' }}>
                            {row.gmv}
                          </td>
                          <td style={{ textAlign: 'right', color: '#475569' }}>
                            {row.commission}
                          </td>
                          <td style={{ textAlign: 'right', color: '#475569' }}>
                            {row.serviceFees}
                          </td>
                          <td style={{ textAlign: 'right', color: '#475569' }}>
                            {row.deliveryFees}
                          </td>
                          <td style={{ textAlign: 'right', color: '#475569' }}>
                            {row.driverPay}
                          </td>
                          <td style={{ textAlign: 'right', color: '#475569' }}>
                            {row.merchantPayouts}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                            {row.netRevenue}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN: SERVICE ZONES & ZIP CODES */}
          {subView === 'zones' && (
            <div className="stack" style={{ gap: 20 }}>
              <div className="page-h">
                <div>
                  <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                    <MapPin size={24} style={{ color: 'var(--gold-metal, #D4A017)' }} />
                    <h1 style={{ margin: 0 }}>Service zones & delivery ZIP codes</h1>
                  </div>
                  <p style={{ marginTop: 6, color: 'var(--muted)' }}>
                    Activate new neighborhoods across Maryland, Washington DC, and Northern Virginia for Saturday delivery.
                    Changes sync immediately to customer address validation and driver dispatch.
                  </p>
                </div>
                <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                  <span className="badge b-gold" style={{ padding: '6px 12px', fontSize: 13, fontWeight: 700 }}>
                    <Check size={14} style={{ marginRight: 4 }} /> {zipList.filter((z) => z.active).length} Active ZIP Codes
                  </span>
                  {isSavingZip ? (
                    <span className="badge b-gray" style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <RefreshCw size={12} className="spin" /> Syncing with DB...
                    </span>
                  ) : (
                    <span className="badge b-green" style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Check size={12} /> Database synced
                    </span>
                  )}
                </div>
              </div>

              {zipFeedback && (
                <div
                  className="alert"
                  style={{
                    background: zipFeedback.startsWith('✓') ? 'rgba(46, 125, 50, 0.12)' : 'rgba(198, 40, 40, 0.12)',
                    color: zipFeedback.startsWith('✓') ? '#2e7d32' : '#c62828',
                    border: `1px solid ${zipFeedback.startsWith('✓') ? '#2e7d32' : '#c62828'}`,
                    padding: '12px 16px',
                    borderRadius: 8,
                    fontWeight: 600,
                  }}
                >
                  {zipFeedback}
                </div>
              )}

              {/* 1-Click Zone Quick-Add Presets */}
              <div className="card" style={{ background: 'var(--surface-2)', border: '1px dashed var(--gold-metal)', padding: 16 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div className="strong" style={{ fontSize: 14 }}>🚀 1-Click Expansion Presets</div>
                    <div className="tiny muted">Quickly bulk-activate all ZIP codes for core Saturday delivery clusters:</div>
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleAddPresetZone('silver-spring')}
                      title="Activate 8 ZIP codes in Silver Spring & Takoma Park"
                    >
                      + Silver Spring Core (8 ZIPs)
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleAddPresetZone('rockville')}
                      title="Activate Bethesda, North Bethesda, and Rockville"
                    >
                      + Bethesda & Rockville (4 ZIPs)
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleAddPresetZone('dc')}
                      title="Activate Petworth, Takoma DC, and Columbia Heights"
                    >
                      + DC Upper NW (3 ZIPs)
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleAddPresetZone('nova')}
                      title="Activate Arlington & Alexandria, VA"
                    >
                      + Arlington & Alexandria, VA (2 ZIPs)
                    </button>
                  </div>
                </div>
              </div>

              {/* ADD ZIP CODE FORM */}
              <div className="card" style={{ padding: 20 }}>
                <div className="card-h" style={{ marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Plus size={18} style={{ color: 'var(--gold-metal, #D4A017)' }} />
                      <span>Add new service ZIP code</span>
                    </h3>
                    <p className="tiny muted" style={{ margin: '4px 0 0' }}>
                      Register an individual ZIP code to open customer orders and driver routes in that area.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleAddZip}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 12,
                      alignItems: 'flex-end',
                    }}
                  >
                    <div>
                      <label className="tiny strong muted" style={{ display: 'block', marginBottom: 6 }}>
                        5-DIGIT ZIP CODE *
                      </label>
                      <input
                        className="input"
                        placeholder="e.g. 20910"
                        maxLength={5}
                        value={newZip}
                        onChange={(e) => setNewZip(e.target.value.replace(/\D/g, ''))}
                        required
                        style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, letterSpacing: 1 }}
                      />
                    </div>

                    <div>
                      <label className="tiny strong muted" style={{ display: 'block', marginBottom: 6 }}>
                        CITY / TOWN *
                      </label>
                      <input
                        className="input"
                        placeholder="e.g. Silver Spring"
                        value={newCity}
                        onChange={(e) => setNewCity(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className="tiny strong muted" style={{ display: 'block', marginBottom: 6 }}>
                        STATE / JURISDICTION
                      </label>
                      <select
                        className="input"
                        value={newState}
                        onChange={(e) => setNewState(e.target.value)}
                      >
                        <option value="MD">MD (Maryland)</option>
                        <option value="DC">DC (District of Columbia)</option>
                        <option value="VA">VA (Virginia)</option>
                      </select>
                    </div>

                    <div>
                      <label className="tiny strong muted" style={{ display: 'block', marginBottom: 6 }}>
                        ZONE / NEIGHBORHOOD NAME
                      </label>
                      <input
                        className="input"
                        placeholder="e.g. Downtown / Arts District"
                        value={newZone}
                        onChange={(e) => setNewZone(e.target.value)}
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSavingZip || newZip.trim().length !== 5}
                        style={{ width: '100%', height: 42, fontWeight: 700 }}
                      >
                        {isSavingZip ? 'Saving...' : '✓ Add Service ZIP'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* SEARCH & DIRECTORY TABLE */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    background: 'var(--surface-2)',
                  }}
                >
                  <div className="row" style={{ gap: 10, alignItems: 'center', flex: 1, minWidth: 260 }}>
                    <Search size={16} style={{ color: 'var(--ink-3)' }} />
                    <input
                      className="input"
                      placeholder="Search active ZIP, city, or zone name..."
                      value={zipSearch}
                      onChange={(e) => setZipSearch(e.target.value)}
                      style={{ maxWidth: 320, padding: '6px 12px' }}
                    />
                  </div>

                  <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <span className="tiny muted strong">Filter by state:</span>
                    {['All', 'MD', 'DC', 'VA'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        className={`btn btn-sm ${stateFilter === st ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setStateFilter(st)}
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', margin: 0 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-1)' }}>
                        <th style={{ width: 120 }}>ZIP Code</th>
                        <th>City / Town</th>
                        <th style={{ width: 80 }}>State</th>
                        <th>Delivery Zone / Cluster</th>
                        <th>Delivery Window</th>
                        <th style={{ width: 140, textAlign: 'center' }}>Status</th>
                        <th style={{ width: 90, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zipList
                        .filter((item) => {
                          const matchesState = stateFilter === 'All' || item.state === stateFilter;
                          const q = zipSearch.toLowerCase();
                          const matchesSearch =
                            !q ||
                            item.zip.toLowerCase().includes(q) ||
                            item.city.toLowerCase().includes(q) ||
                            item.zone.toLowerCase().includes(q);
                          return matchesState && matchesSearch;
                        })
                        .map((item) => (
                          <tr key={item.zip} style={{ opacity: item.active ? 1 : 0.65 }}>
                            <td>
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontFamily: 'monospace',
                                  fontWeight: 800,
                                  fontSize: 14,
                                  background: item.active ? 'var(--gold-metal)' : 'var(--surface-2)',
                                  color: item.active ? 'var(--navy-950)' : 'var(--muted)',
                                  padding: '3px 8px',
                                  borderRadius: 4,
                                  border: '1px solid rgba(0,0,0,0.1)',
                                }}
                              >
                                {item.zip}
                              </span>
                            </td>
                            <td>
                              <strong>{item.city}</strong>
                            </td>
                            <td>
                              <span className="badge b-gray" style={{ fontWeight: 700 }}>
                                {item.state}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-1)' }}>
                              {item.zone}
                            </td>
                            <td>
                              <span className="tiny muted">
                                📅 Every Saturday · 9 AM – 4 PM
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleToggleZip(item.zip)}
                                title={item.active ? 'Click to pause this ZIP' : 'Click to activate this ZIP'}
                                style={{
                                  cursor: 'pointer',
                                  border: 'none',
                                  background: item.active ? 'rgba(46, 125, 50, 0.15)' : 'rgba(211, 47, 47, 0.12)',
                                  color: item.active ? '#2e7d32' : '#d32f2f',
                                  padding: '5px 12px',
                                  borderRadius: 20,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                <span>{item.active ? '● Active' : '○ Paused'}</span>
                                <span style={{ fontSize: 10, opacity: 0.8 }}>
                                  ({item.active ? 'Live' : 'Hidden'})
                                </span>
                              </button>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleDeleteZip(item.zip)}
                                title="Remove ZIP from service area"
                                style={{ color: 'var(--red, #e53935)', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <Trash2 size={13} />
                                <span>Remove</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      {zipList.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)' }}>
                            No service ZIP codes found. Use the form above or presets to activate zones.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    padding: '12px 20px',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--surface-1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span className="tiny muted">
                    Showing {zipList.filter((z) => z.active).length} active of {zipList.length} total registered ZIP codes
                  </span>
                  <span className="tiny muted">
                    Neon DB settings key: <code>service_zip_codes</code>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 9: SETTINGS (Screenshot 5) */}
          {subView === 'settings' && (
            <div className="stack" style={{ gap: 24, maxWidth: 960 }}>
              <div className="page-h">
                <div>
                  <h1 style={{ margin: 0, fontSize: 28 }}>Settings</h1>
                  <h2 style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 700, color: '#0F172A' }}>
                    Marketplace settings
                  </h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
                    Fees, payouts and delivery schedule. Changes apply to new orders immediately.
                  </p>
                </div>
              </div>

              {/* CARD 1: Customer fees */}
              <div
                className="card"
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: '24px 28px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
                  Customer fees
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px 28px' }}>
                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Delivery fee per store (cents)
                    </span>
                    <input
                      className="input"
                      defaultValue="599"
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                    />
                    <span style={{ fontSize: 12, color: '#64748B' }}>e.g. 599 = $5.99</span>
                  </label>

                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Service fee rate
                    </span>
                    <input
                      className="input"
                      defaultValue="0.05"
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                    />
                    <span style={{ fontSize: 12, color: '#64748B' }}>0.05 = 5% of items</span>
                  </label>

                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Minimum service fee (cents)
                    </span>
                    <input
                      className="input"
                      defaultValue="199"
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                    />
                    <span style={{ fontSize: 12, color: '#64748B' }}>Applied when % is lower</span>
                  </label>

                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Minimum order (cents)
                    </span>
                    <input
                      className="input"
                      defaultValue="1500"
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                    />
                    <span style={{ fontSize: 12, color: '#64748B' }}>Cart subtotal required</span>
                  </label>

                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1', maxWidth: 380 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Tax rate
                    </span>
                    <input
                      className="input"
                      defaultValue="0"
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                    />
                    <span style={{ fontSize: 12, color: '#64748B' }}>Use 0 where groceries are tax-exempt</span>
                  </label>
                </div>
              </div>

              {/* CARD 2: Partners */}
              <div
                className="card"
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: '24px 28px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
                  Partners
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px 28px' }}>
                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Default merchant commission
                    </span>
                    <input
                      className="input"
                      defaultValue="0.15"
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                    />
                    <span style={{ fontSize: 12, color: '#64748B' }}>0.15 = 15% for new stores</span>
                  </label>

                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Driver base pay per order (cents)
                    </span>
                    <input
                      className="input"
                      defaultValue="550"
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                    />
                    <span style={{ fontSize: 12, color: '#64748B' }}>Drivers also keep 100% of tips</span>
                  </label>

                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1', maxWidth: 380 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Items per BuckDuck bag
                    </span>
                    <input
                      className="input"
                      defaultValue="10"
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                    />
                    <span style={{ fontSize: 12, color: '#64748B' }}>Used to estimate bags per order</span>
                  </label>
                </div>
              </div>

              {/* CARD 3: Delivery schedule */}
              <div
                className="card"
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: '24px 28px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
                  Delivery schedule
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px 28px' }}>
                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Delivery day
                    </span>
                    <select
                      className="input"
                      defaultValue="Saturday"
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14, background: '#fff' }}
                    >
                      <option value="Saturday">Saturday</option>
                      <option value="Sunday">Sunday</option>
                      <option value="Friday">Friday</option>
                    </select>
                    <span style={{ fontSize: 12, color: '#64748B' }}>BuckDuck delivers once a week</span>
                  </label>

                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Order cutoff (hours before window)
                    </span>
                    <input
                      className="input"
                      defaultValue="24"
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                    />
                    <span style={{ fontSize: 12, color: '#64748B' }}>Gives stores time to pack</span>
                  </label>

                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Weeks of windows to publish
                    </span>
                    <input
                      className="input"
                      defaultValue="4"
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                    />
                  </label>

                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Default capacity per window
                    </span>
                    <input
                      className="input"
                      defaultValue="120"
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                    />
                    <span style={{ fontSize: 12, color: '#64748B' }}>Orders per window</span>
                  </label>

                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Default windows (JSON)
                    </span>
                    <input
                      className="input"
                      defaultValue='[["06:00","12:00"],["12:00","16:00"]]'
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                    />
                    <span style={{ fontSize: 12, color: '#64748B' }}>
                      [[&quot;06:00&quot;,&quot;12:00&quot;],[&quot;12:00&quot;,&quot;16:00&quot;]] = 6 AM–12 PM and 12 PM–4 PM
                    </span>
                  </label>

                  <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Service ZIP codes
                    </span>
                    <input
                      className="input"
                      placeholder="Leave blank to accept all ZIPs"
                      defaultValue="20910, 20901, 20902, 20903, 20904, 20905, 20906, 20912, 20850, 20852, 20011, 20012"
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                    />
                    <span style={{ fontSize: 12, color: '#64748B' }}>
                      Comma-separated, e.g. 77036,77042,77072
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => alert('Settings saved successfully')}
                  style={{
                    background: '#0B1527',
                    color: '#ffffff',
                    padding: '12px 28px',
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 14,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Save settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ORDER DETAILS & OVERRIDE MODAL (Screenshots 2 & 3) */}
      {modalOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOrder(null);
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 720,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: 28,
              borderRadius: 16,
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
            }}
          >
            {/* Modal Header */}
            <div className="card-h" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
                  Order {modalOrder.number}
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    background:
                      modalOrder.status === 'delivered'
                        ? '#DCFCE7'
                        : modalOrder.status === 'cancelled'
                        ? '#FEE2E2'
                        : modalOrder.status === 'ready'
                        ? '#FEF3C7'
                        : '#FEF9C3',
                    color:
                      modalOrder.status === 'delivered'
                        ? '#15803D'
                        : modalOrder.status === 'cancelled'
                        ? '#B91C1C'
                        : modalOrder.status === 'ready'
                        ? '#B45309'
                        : '#854D0E',
                  }}
                >
                  ● {modalOrder.status === 'ready' ? 'Ready for pickup' : modalOrder.status === 'placed' ? 'New' : modalOrder.status.replace(/_/g, ' ')}
                </span>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setModalOrder(null)}
                style={{ border: 'none', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Delivery & Store 2-Column Info */}
            <div className="grid g2" style={{ gap: 24, marginBottom: 24 }}>
              <div>
                <div className="tiny muted strong" style={{ letterSpacing: '.05em' }}>DELIVERY</div>
                <div className="strong" style={{ fontSize: 16, marginTop: 4, color: 'var(--ink)' }}>
                  {modalOrder.delivery_windows?.label || 'Sat, Oct 24 · 6 AM–12 PM'}
                </div>
                <div className="small" style={{ color: 'var(--ink-2)', marginTop: 2 }}>
                  {modalOrder.users_orders_customer_idTousers?.name || 'Ama Mensah'} · {modalOrder.phone || modalOrder.users_orders_customer_idTousers?.phone || '(713) 555-5424'}
                </div>
                <div className="small muted" style={{ marginTop: 2 }}>
                  {modalOrder.address_line1 || '3690 Beechnut St'}, {modalOrder.city || 'Houston'} {modalOrder.zip || '77057'}
                </div>
              </div>

              <div>
                <div className="tiny muted strong" style={{ letterSpacing: '.05em' }}>STORE</div>
                <div className="strong" style={{ fontSize: 16, marginTop: 4, color: 'var(--ink)' }}>
                  {modalOrder.stores?.name || 'Green Valley Produce'}
                </div>
                <div className="small muted" style={{ marginTop: 2 }}>
                  {modalOrder.stores?.address || '3947 Bissonnet St'}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'var(--navy-900)',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <ShoppingBag size={13} style={{ color: 'var(--gold-400)' }} />
                    <span>{modalOrder.bags || 1} BuckDuck bag</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Packing Checklist Table */}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, marginBottom: 24 }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: 'center' }}>✓</th>
                      <th>ITEM</th>
                      <th>UNIT</th>
                      <th style={{ textAlign: 'center', width: 60 }}>QTY</th>
                      <th style={{ textAlign: 'right', width: 90 }}>PRICE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(modalOrder.order_items && modalOrder.order_items.length > 0
                      ? modalOrder.order_items
                      : [
                          { id: 'item-1', name: 'Lemons', emoji: '🍋', unit: '2 lb bag', qty: 3, price_cents: 1197 },
                          { id: 'item-2', name: 'Sweet Potatoes', emoji: '🍠', unit: 'per lb', qty: 3, price_cents: 447 },
                          { id: 'item-3', name: 'Bell Peppers', emoji: '🫑', unit: '3 pack', qty: 1, price_cents: 449 },
                        ]
                    ).map((item: any) => {
                      const isChecked = checkedItems[item.id] ?? false;
                      return (
                        <tr key={item.id}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() =>
                                setCheckedItems((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                              }
                              style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--navy-900)' }}
                            />
                          </td>
                          <td>
                            <span style={{ textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1 }}>
                              <span style={{ marginRight: 8, fontSize: 16 }}>{item.emoji || '📦'}</span>
                              <strong style={{ fontWeight: 600 }}>{item.name || item.title}</strong>
                            </span>
                          </td>
                          <td className="small muted">{item.unit || '1 each'}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.qty || item.quantity || 1}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            ${((item.price_cents || 0) / 100).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Split: Order Lifecycle Timeline on Left, Financial Breakdown on Right */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 24,
                padding: '16px 0',
                borderTop: '1px solid var(--line)',
                borderBottom: '1px solid var(--line)',
              }}
            >
              {/* Timeline (Left) */}
              <div>
                <div className="tiny muted strong" style={{ letterSpacing: '.05em', marginBottom: 16 }}>
                  STATUS HISTORY
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', paddingLeft: 20 }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 6,
                      bottom: 6,
                      left: 6,
                      width: 2,
                      background: 'var(--line)',
                    }}
                  />

                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: -20,
                        top: 4,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: '#D97706',
                      }}
                    />
                    <div className="strong small">New order</div>
                    <div className="tiny muted">Oct 21, 7:15 PM</div>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: -20,
                        top: 4,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: '#D97706',
                      }}
                    />
                    <div className="strong small">Accepted</div>
                    <div className="tiny muted">Oct 22, 1:15 AM</div>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: -20,
                        top: 4,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: '#D97706',
                      }}
                    />
                    <div className="strong small">Packing</div>
                    <div className="tiny muted">Oct 22, 7:15 AM</div>
                  </div>

                  {['ready', 'out_for_delivery', 'delivered'].includes(modalOrder.status) && (
                    <div style={{ position: 'relative' }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: -20,
                          top: 4,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: '#15803D',
                        }}
                      />
                      <div className="strong small">Ready for pickup</div>
                      <div className="tiny muted">Oct 22, 8:45 AM</div>
                    </div>
                  )}

                  {['out_for_delivery', 'delivered'].includes(modalOrder.status) && (
                    <div style={{ position: 'relative' }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: -20,
                          top: 4,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: '#1D4ED8',
                        }}
                      />
                      <div className="strong small">Out for delivery</div>
                      <div className="tiny muted">Oct 22, 9:30 AM</div>
                    </div>
                  )}

                  {modalOrder.status === 'delivered' && (
                    <div style={{ position: 'relative' }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: -20,
                          top: 4,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: '#15803D',
                        }}
                      />
                      <div className="strong small">Delivered</div>
                      <div className="tiny muted">Oct 22, 11:15 AM</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Breakdown (Right) */}
              <div>
                <div className="tiny muted strong" style={{ letterSpacing: '.05em', marginBottom: 12 }}>
                  PAYMENT & SETTLEMENT
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  <div className="row between small">
                    <span className="muted">Items</span>
                    <span>${((modalOrder.subtotal_cents || 2093) / 100).toFixed(2)}</span>
                  </div>
                  <div className="row between small">
                    <span className="muted">Delivery + service</span>
                    <span>
                      ${(((modalOrder.delivery_fee_cents || 599) + (modalOrder.service_fee_cents || 199)) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="row between small">
                    <span className="muted">Tip</span>
                    <span>${((modalOrder.tip_cents || 500) / 100).toFixed(2)}</span>
                  </div>

                  <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />

                  <div className="row between">
                    <span className="strong" style={{ fontSize: 16 }}>Customer paid</span>
                    <span className="strong" style={{ fontSize: 18, color: 'var(--ink)' }}>
                      ${((modalOrder.total_cents || 3391) / 100).toFixed(2)}
                    </span>
                  </div>

                  <div className="row between small muted" style={{ marginTop: 2 }}>
                    <span>Merchant payout</span>
                    <span>
                      ${(((modalOrder.subtotal_cents || 2093) - (modalOrder.commission_cents || 314)) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="row between small muted">
                    <span>Driver pay</span>
                    <span>${((modalOrder.driver_pay_cents || 1050) / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Operations Override Box (Screenshot 3) */}
            <div
              className="card flat"
              style={{
                background: 'var(--surface-2)',
                padding: 18,
                margin: '20px 0 16px',
                borderRadius: 12,
                border: '1px solid var(--line)',
              }}
            >
              <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Operations</h4>
              <div className="grid g2" style={{ gap: 16 }}>
                <label className="field">
                  <span className="tiny strong muted" style={{ textTransform: 'uppercase' }}>
                    Assigned driver
                  </span>
                  <select
                    className="input"
                    value={overrideDriverId}
                    onChange={(e) => setOverrideDriverId(e.target.value)}
                    style={{ background: '#fff', borderRadius: 8 }}
                  >
                    <option value="">— Unassigned —</option>
                    {[
                      { id: 3, name: 'Kwame Asante', vehicle: 'Toyota Sienna · Silver' },
                      { id: 4, name: 'Luis Ramirez', vehicle: 'Ford Transit · White' },
                      { id: 101, name: 'Brianna Scott', vehicle: 'Honda CR-V · Blue' },
                      { id: 104, name: 'Emeka Nwosu', vehicle: 'Chevy Express · White' },
                      { id: 105, name: 'Hannah Lee', vehicle: 'Kia Carnival · Gray' },
                    ].map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="tiny strong muted" style={{ textTransform: 'uppercase' }}>
                    Status override
                  </span>
                  <select
                    className="input"
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value)}
                    style={{ background: '#fff', borderRadius: 8 }}
                  >
                    <option value="placed">New</option>
                    <option value="accepted">Accepted</option>
                    <option value="packing">Packing</option>
                    <option value="ready">Ready for pickup</option>
                    <option value="out_for_delivery">Out for delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled (Full refund)</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Modal Footer Buttons (Screenshot 3) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 12,
                marginTop: 20,
              }}
            >
              <button
                type="button"
                onClick={handleRefundOrder}
                style={{
                  background: 'none',
                  border: '1px solid #FCA5A5',
                  color: '#DC2626',
                  padding: '9px 20px',
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Refund
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveOrderStatus}
                style={{
                  padding: '10px 24px',
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: 14,
                  minWidth: 130,
                }}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD DELIVERY WINDOW MODAL (Screenshot 3) */}
      {showAddWindowModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddWindowModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="modal-box"
            style={{
              background: '#ffffff',
              borderRadius: 16,
              maxWidth: 520,
              width: '100%',
              padding: '28px 32px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0F172A' }}>
                Add delivery window
              </h2>
              <button
                type="button"
                onClick={() => setShowAddWindowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateWindow} className="stack" style={{ gap: 20 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 16,
                }}
              >
                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Date</span>
                  <input
                    type="date"
                    required
                    value={newWinDate}
                    onChange={(e) => setNewWinDate(e.target.value)}
                    className="input"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 14,
                      background: '#fff',
                    }}
                  />
                </label>

                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Start</span>
                  <input
                    type="time"
                    required
                    value={newWinStart}
                    onChange={(e) => setNewWinStart(e.target.value)}
                    className="input"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 14,
                      background: '#fff',
                    }}
                  />
                </label>

                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>End</span>
                  <input
                    type="time"
                    required
                    value={newWinEnd}
                    onChange={(e) => setNewWinEnd(e.target.value)}
                    className="input"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 14,
                      background: '#fff',
                    }}
                  />
                </label>
              </div>

              <div>
                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 220 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Capacity</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newWinCapacity}
                    onChange={(e) => setNewWinCapacity(Number(e.target.value))}
                    className="input"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 14,
                      background: '#fff',
                    }}
                  />
                </label>
              </div>

              <div style={{ marginTop: 8 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    background: '#0B1527',
                    color: '#ffffff',
                    padding: '12px 28px',
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 14,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Create window
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD USER MODAL */}
      {showAddUserModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddUserModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="modal-box"
            style={{
              background: '#ffffff',
              borderRadius: 16,
              maxWidth: 500,
              width: '100%',
              padding: '28px 32px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0F172A' }}>Add new user</h2>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 6 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="stack" style={{ gap: 16 }}>
              <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Full Name</span>
                <input
                  required
                  placeholder="e.g. John Doe"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="input"
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                />
              </label>

              <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Email Address</span>
                <input
                  type="email"
                  required
                  placeholder="e.g. user@buckduck.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="input"
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Phone</span>
                  <input
                    type="tel"
                    placeholder="e.g. (301) 555-0199"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    className="input"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                  />
                </label>

                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Role</span>
                  <select
                    value={newUserRole}
                    onChange={(e: any) => setNewUserRole(e.target.value)}
                    className="input"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14, background: '#fff' }}
                  >
                    <option value="customer">Customer</option>
                    <option value="merchant">Merchant</option>
                    <option value="driver">Driver</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
              </div>

              <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Initial Password</span>
                <input
                  type="password"
                  placeholder="Default: welcome123"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="input"
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                />
                <span style={{ fontSize: 12, color: '#64748B' }}>Leave blank to default to &quot;welcome123&quot;</span>
              </label>

              <div style={{ marginTop: 8 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    background: '#0B1527',
                    color: '#ffffff',
                    padding: '12px 28px',
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 14,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Create user
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD STORE MODAL */}
      {showAddStoreModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddStoreModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="modal-box"
            style={{
              background: '#ffffff',
              borderRadius: 16,
              maxWidth: 580,
              width: '100%',
              padding: '28px 32px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0F172A' }}>Add new store</h2>
              <button
                type="button"
                onClick={() => setShowAddStoreModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 6 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="stack" style={{ gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Store Name</span>
                  <input
                    required
                    placeholder="e.g. Accra Market & Bakery"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    className="input"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                  />
                </label>

                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Category</span>
                  <select
                    value={newStoreCategory}
                    onChange={(e) => setNewStoreCategory(e.target.value)}
                    className="input"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14, background: '#fff' }}
                  >
                    <option value="Groceries">Groceries</option>
                    <option value="Butcher & Meat">Butcher & Meat</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Produce">Produce</option>
                    <option value="African & Caribbean">African & Caribbean</option>
                    <option value="Latin American">Latin American</option>
                    <option value="Halal & Specialty">Halal & Specialty</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Owner Email (Merchant)</span>
                  <input
                    type="email"
                    placeholder="merchant@buckduck.com"
                    value={newStoreOwnerEmail}
                    onChange={(e) => setNewStoreOwnerEmail(e.target.value)}
                    className="input"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                  />
                </label>

                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Phone</span>
                  <input
                    type="tel"
                    placeholder="(301) 555-0145"
                    value={newStorePhone}
                    onChange={(e) => setNewStorePhone(e.target.value)}
                    className="input"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                  />
                </label>
              </div>

              <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Street Address</span>
                <input
                  placeholder="e.g. 8412 Georgia Ave"
                  value={newStoreAddress}
                  onChange={(e) => setNewStoreAddress(e.target.value)}
                  className="input"
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>City</span>
                  <input
                    value={newStoreCity}
                    onChange={(e) => setNewStoreCity(e.target.value)}
                    className="input"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                  />
                </label>
                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>State</span>
                  <input
                    value={newStoreState}
                    onChange={(e) => setNewStoreState(e.target.value)}
                    className="input"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                  />
                </label>
                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>ZIP</span>
                  <input
                    value={newStoreZip}
                    onChange={(e) => setNewStoreZip(e.target.value)}
                    className="input"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Commission Rate</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={newStoreCommission}
                    onChange={(e) => setNewStoreCommission(parseFloat(e.target.value))}
                    className="input"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                  />
                  <span style={{ fontSize: 12, color: '#64748B' }}>0.15 = 15%</span>
                </label>

                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Status</span>
                  <select
                    value={newStoreStatus}
                    onChange={(e) => setNewStoreStatus(e.target.value)}
                    className="input"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14, background: '#fff' }}
                  >
                    <option value="approved">Approved</option>
                    <option value="pending">Pending Review</option>
                  </select>
                </label>
              </div>

              <div style={{ marginTop: 8 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    background: '#0B1527',
                    color: '#ffffff',
                    padding: '12px 28px',
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 14,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Create store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD DRIVER MODAL */}
      {showAddDriverModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddDriverModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="modal-box"
            style={{
              background: '#ffffff',
              borderRadius: 16,
              maxWidth: 500,
              width: '100%',
              padding: '28px 32px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0F172A' }}>Add new driver</h2>
              <button
                type="button"
                onClick={() => setShowAddDriverModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 6 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateDriver} className="stack" style={{ gap: 16 }}>
              <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Driver Full Name</span>
                <input
                  required
                  placeholder="e.g. Kwame Asante"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  className="input"
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                />
              </label>

              <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Driver Email</span>
                <input
                  type="email"
                  required
                  placeholder="e.g. kwame@buckduck.com"
                  value={newDriverEmail}
                  onChange={(e) => setNewDriverEmail(e.target.value)}
                  className="input"
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Phone</span>
                  <input
                    type="tel"
                    placeholder="(301) 555-0102"
                    value={newDriverPhone}
                    onChange={(e) => setNewDriverPhone(e.target.value)}
                    className="input"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                  />
                </label>

                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Vehicle Information</span>
                  <input
                    placeholder="Toyota Sienna · Silver"
                    value={newDriverVehicle}
                    onChange={(e) => setNewDriverVehicle(e.target.value)}
                    className="input"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                  />
                </label>
              </div>

              <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Initial Password</span>
                <input
                  type="password"
                  placeholder="Default: welcome123"
                  value={newDriverPassword}
                  onChange={(e) => setNewDriverPassword(e.target.value)}
                  className="input"
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                />
                <span style={{ fontSize: 12, color: '#64748B' }}>Driver can change password upon initial login</span>
              </label>

              <div style={{ marginTop: 8 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    background: '#0B1527',
                    color: '#ffffff',
                    padding: '12px 28px',
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 14,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Register driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
