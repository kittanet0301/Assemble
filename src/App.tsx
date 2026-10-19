import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  DoorOpen,
  Headphones,
  Home,
  Info,
  Leaf,
  Link,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MessageCircle,
  MicOff,
  Monitor,
  MoreHorizontal,
  Navigation,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Smile,
  Sparkles,
  Users,
  VideoOff,
  X,
} from 'lucide-react';
import { STATUSES, ROOMS } from '../shared/world.js';
import { api } from './api';
import { Avatar } from './Avatar';
import { CharacterEditor } from './CharacterEditor';
import { OfficeMap } from './OfficeMap';
import { Dialog } from './Dialog';
import type { Config, Message, RoomInfo, Snapshot, User } from './types';
const Meeting = lazy(() => import('./Meeting'));
const empty: Snapshot = {
  serverTime: 0,
  selfId: '',
  peers: [],
  directory: [],
  rooms: ROOMS.map((r) => ({ ...r, count: 0 })),
};
const noop = () => {};
const time = (value: number) =>
  new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' }).format(value);
function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? 'light' : ''}`}>
      <span className="brand-mark">
        <Leaf size={21} strokeWidth={2.5} />
      </span>
      <span>
        assemble<span className="brand-period">.</span>
      </span>
    </div>
  );
}

function Login({ config, onLogin }: { config: Config; onLogin: (user: User) => void }) {
  const [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(new URLSearchParams(location.search).get('authError') ?? ''),
    [invite, setInvite] = useState<{ room: RoomInfo; orgName: string } | null>(null);
  const inviteToken = useRef(new URLSearchParams(location.search).get('invite'));
  useEffect(() => {
    if (inviteToken.current)
      api('/api/invites/preview?token=' + encodeURIComponent(inviteToken.current))
        .then(setInvite)
        .catch((e) => setError(e.message));
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (inviteToken.current)
        await api('/api/invites/accept', { token: inviteToken.current, name });
      else await api('/api/auth/demo', { name });
      const result = await api('/api/me');
      if (!result.user) throw new Error('เซสชันไม่พร้อม กรุณาลองใหม่');
      history.replaceState(null, '', '/');
      onLogin(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-page">
      <div className="login-story" aria-hidden="true" inert>
        <Brand />
        <div className="story-copy">
          <div className="eyebrow">
            <span className="live-dot" /> A LITTLE CLOSER, EVERY DAY
          </div>
          <h1>
            ออฟฟิศของเรา
            <br />
            อยู่ใกล้กันได้<span>จากทุกที่</span>
          </h1>
          <p>
            มีที่นั่งให้คุณเสมอ แวะทักทาย แชร์ไอเดีย
            <br />
            แล้วสร้างสิ่งดี ๆ ไปด้วยกัน
          </p>
        </div>
        <div className="login-map">
          <OfficeMap
            snapshot={empty}
            send={noop}
            zoom={1}
            setZoom={noop}
            focusedId={null}
            onDesk={noop}
            onRoom={noop}
            reactions={{}}
          />
        </div>
        <span className="story-foot">
          พื้นที่เล็ก ๆ สำหรับทีมที่มีไอเดียใหญ่ ๆ <Sparkles size={14} />
        </span>
      </div>
      <div className="login-form-side">
        <div className="login-top">
          <span>YOUR TEAM. YOUR SPACE.</span>
          <span className="tiny-leaf">✳</span>
        </div>
        <div className="login-form">
          <span className="welcome-symbol">
            <DoorOpen size={27} />
          </span>
          <h2>{invite ? `มาพบกันที่ ${invite.room.name}` : 'เข้าสู่ออฟฟิศ'}</h2>
          <p>
            {invite
              ? `คุณได้รับเชิญเข้าประชุมกับ ${invite.orgName}`
              : 'พื้นที่ทำงานออนไลน์ของทีมคุณ'}
          </p>
          {config.demo && !inviteToken.current && (
            <div className="demo-notice">
              <Info size={17} />
              <span>
                {config.preview
                  ? 'พรีวิวสำหรับทีม · ใช้ชื่อทดลองได้เลย'
                  : 'เดโมในเครื่อง · ใช้ชื่อทดลองได้เลย'}
                <br />
                <small>บัญชีบริษัทจะเชื่อมในขั้นเปิดใช้งานจริง</small>
              </span>
            </div>
          )}
          {(config.demo || inviteToken.current) && (
            <form onSubmit={submit}>
              <label htmlFor="display-name">ชื่อที่ให้ทีมเห็น</label>
              <input
                id="display-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น มิน · ทีมออกแบบ"
                maxLength={40}
                required
              />
              <button
                className="primary login-submit"
                disabled={busy || !name.trim() || (!!inviteToken.current && !invite)}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <>
                    เข้า{invite ? 'ห้องประชุม' : 'ออฟฟิศทดลอง'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}
          {!inviteToken.current && config.providers.length > 0 && (
            <>
              <div className="or">
                <span>ใช้บัญชีบริษัท</span>
              </div>
              {config.providers.map((p) => (
                <a key={p} className="sso-button" href={`/auth/${p}`}>
                  <span className={p === 'google' ? 'google-icon' : 'microsoft-icon'}>
                    {p === 'google' ? 'G' : '⊞'}
                  </span>
                  เข้าสู่ระบบด้วย {p === 'google' ? 'Google' : 'Microsoft'}
                  <ArrowUpRight size={16} />
                </a>
              ))}
            </>
          )}
          {!config.demo && !config.providers.length && !inviteToken.current && (
            <div className="setup-card">
              <ShieldCheck size={24} />
              <h3>พื้นที่ขององค์กรพร้อมแล้ว</h3>
              <p>
                ผู้ดูแลต้องเชื่อมบัญชีบริษัทก่อนเริ่มใช้งาน ติดต่อผู้ดูแลเพื่อเปิดการเข้าสู่ระบบ
              </p>
            </div>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="login-privacy">
            <ShieldCheck size={15} /> พื้นที่ส่วนตัวขององค์กรคุณ
          </div>
        </div>
        <footer>
          Make room for good things.<span>© {new Date().getFullYear()} Assemble</span>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null),
    [user, setUser] = useState<User | null>(null),
    [loaded, setLoaded] = useState(false),
    [fatal, setFatal] = useState('');
  useEffect(() => {
    Promise.all([api<Config>('/api/config'), api('/api/me')])
      .then(([c, me]) => {
        setConfig(c);
        setUser(me.user);
      })
      .catch((e) => setFatal(e.message))
      .finally(() => setLoaded(true));
  }, []);
  if (fatal)
    return (
      <div className="loading-screen">
        <Brand />
        <p role="alert">เชื่อมต่อออฟฟิศไม่ได้: {fatal}</p>
        <button className="primary" onClick={() => location.reload()}>
          ลองอีกครั้ง
        </button>
      </div>
    );
  if (!loaded || !config)
    return (
      <div className="loading-screen">
        <Brand />
        <LoaderCircle className="spin" />
        <p>กำลังเปิดประตูออฟฟิศ…</p>
      </div>
    );
  return user ? (
    <Office key={user.id} config={config} user={user} onLogout={() => setUser(null)} />
  ) : (
    <Login config={config} onLogin={setUser} />
  );
}

function Office({ config, user, onLogout }: { config: Config; user: User; onLogout: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ ...empty, selfId: user.id }),
    [connected, setConnected] = useState(false),
    [connectionError, setConnectionError] = useState(''),
    [sidebar, setSidebar] = useState<'people' | 'rooms'>('people'),
    [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 900),
    [search, setSearch] = useState(''),
    [zoom, setZoom] = useState(1),
    [focusedId, setFocusedId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false),
    [channel, setChannel] = useState(user.role === 'guest' ? user.roomScope! : 'general'),
    [messages, setMessages] = useState<Record<string, Message[]>>({}),
    [draft, setDraft] = useState(''),
    [unread, setUnread] = useState(0);
  const [modal, setModal] = useState<'invite' | 'settings' | 'help' | 'desk' | null>(null),
    [selectedDesk, setSelectedDesk] = useState(''),
    [inviteRoom, setInviteRoom] = useState('bloom'),
    [inviteUrl, setInviteUrl] = useState(''),
    [invites, setInvites] = useState<any[]>([]),
    [inviteBusy, setInviteBusy] = useState(false),
    [copied, setCopied] = useState(false);
  const [roomPanel, setRoomPanel] = useState<string | null>(null),
    [media, setMedia] = useState<{ token: string; url: string; roomId: string } | null>(null),
    [mediaBusy, setMediaBusy] = useState(false),
    [settingsTab, setSettingsTab] = useState('profile'),
    [statusOpen, setStatusOpen] = useState(false),
    [reactionOpen, setReactionOpen] = useState(false),
    [reactions, setReactions] = useState<Record<string, string>>({}),
    [toast, setToast] = useState(''),
    [confirmRevoke, setConfirmRevoke] = useState<User | null>(null);
  const ws = useRef<WebSocket | null>(null),
    chatRef = useRef<HTMLDivElement>(null),
    chatOpenRef = useRef(chatOpen),
    toastTimer = useRef(0),
    timers = useRef(new Set<number>());
  chatOpenRef.current = chatOpen;
  const notify = useCallback((text: string) => {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = window.setTimeout(() => setToast(''), 4500);
  }, []);
  const send = useCallback((value: Record<string, unknown>) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(value));
  }, []);
  const self = snapshot.peers.find((p) => p.id === user.id),
    currentUser = self ?? user,
    currentRoom = snapshot.rooms.find((r) => r.id === self?.roomId),
    selectedRoom = snapshot.rooms.find((r) => r.id === roomPanel),
    onlineIds = new Set(snapshot.peers.map((p) => p.id));
  const directory = snapshot.directory.filter((m) =>
      m.name.toLowerCase().includes(search.toLowerCase()),
    ),
    online = directory.filter((m) => onlineIds.has(m.id)),
    offline = directory.filter((m) => !onlineIds.has(m.id));
  useEffect(() => {
    let disposed = false,
      retry: number | undefined;
    const connect = () => {
      const socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`,
      );
      ws.current = socket;
      socket.onopen = () => {
        setConnected(true);
        setConnectionError('');
      };
      socket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'snapshot')
          setSnapshot({ ...data, serverTime: data.serverTime ?? Date.now() });
        if (data.type === 'history')
          setMessages((old) => ({ ...old, [data.channel]: data.messages }));
        if (data.type === 'chat') {
          setMessages((old) => ({
            ...old,
            [data.message.channel]: [...(old[data.message.channel] ?? []), data.message].slice(-80),
          }));
          if (!chatOpenRef.current && data.message.senderId !== user.id) setUnread((n) => n + 1);
        }
        if (data.type === 'error' || data.type === 'notice') notify(data.text);
        if (data.type === 'reaction') {
          setReactions((old) => ({ ...old, [data.userId]: data.emoji }));
          const timer = window.setTimeout(() => {
            setReactions((old) => {
              const next = { ...old };
              delete next[data.userId];
              return next;
            });
            timers.current.delete(timer);
          }, 2600);
          timers.current.add(timer);
        }
      };
      socket.onclose = (e) => {
        setConnected(false);
        if (disposed) return;
        if ([4001, 4003, 4004, 4008].includes(e.code)) {
          setConnectionError(e.reason || 'เซสชันสิ้นสุดแล้ว');
          setMedia(null);
          return;
        }
        retry = window.setTimeout(
          () =>
            api('/api/me')
              .then((me) => {
                if (disposed) return;
                if (!me.user) {
                  setConnectionError('เซสชันหมดอายุ กรุณาเข้าสู่ออฟฟิศอีกครั้ง');
                  setMedia(null);
                } else connect();
              })
              .catch(() => {
                if (!disposed) retry = window.setTimeout(connect, 2500);
              }),
          2000,
        );
      };
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      ws.current?.close();
      timers.current.forEach(clearTimeout);
    };
  }, [user.id, notify]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, channel, chatOpen]);
  useEffect(() => {
    if (media && (self?.roomId !== media.roomId || !connected)) setMedia(null);
  }, [self?.roomId, connected, media]);
  useEffect(() => {
    if (channel !== 'general' && self && self.roomId !== channel)
      setChannel(user.role === 'guest' ? user.roomScope! : 'general');
  }, [self, channel, user]);
  useEffect(() => {
    if (user.role === 'guest' && self?.roomId) setRoomPanel(self.roomId);
  }, [self?.roomId, user.role]);
  const logout = async () => {
    try {
      await api('/api/auth/logout', {});
      ws.current?.close();
      onLogout();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const openInvite = (id?: string) => {
    setInviteRoom(id ?? self?.roomId ?? 'bloom');
    setInviteUrl('');
    setCopied(false);
    setModal('invite');
    api('/api/invites')
      .then((r) => setInvites(r.invites))
      .catch((e) => notify(e.message));
  };
  const createInvite = async () => {
    setInviteBusy(true);
    try {
      const result = await api('/api/invites', { roomId: inviteRoom });
      setInviteUrl(result.url);
      setInvites((await api('/api/invites')).invites);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setInviteBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      notify('คัดลอกอัตโนมัติไม่ได้ เลือกข้อความลิงก์แล้วคัดลอกได้เลย');
    }
  };
  const joinMedia = async () => {
    if (!self?.roomId) return;
    setMediaBusy(true);
    try {
      const data = await api('/api/meeting/token', { roomId: self.roomId });
      setMedia({ ...data, roomId: self.roomId });
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setMediaBusy(false);
    }
  };
  const openRoom = (id: string) => {
    setRoomPanel(id);
    setChatOpen(false);
  };
  const toggleChat = () => {
    setChatOpen(!chatOpen);
    if (!chatOpen) setRoomPanel(null);
    setUnread(0);
  };
  const selectChannel = (id: string) => {
    setChannel(id);
    send({ type: 'history', channel: id });
  };
  const focusPerson = (id: string) => {
    setFocusedId(id);
    setZoom(1.5);
    setSidebarOpen(false);
  };
  const memberRow = (member: User, isOnline: boolean) => {
    const peer = snapshot.peers.find((p) => p.id === member.id),
      status = STATUSES[member.status];
    return (
      <button
        key={member.id}
        className="member-row"
        onClick={() =>
          isOnline ? focusPerson(member.id) : notify(`${member.name} ยังไม่ได้เข้าออฟฟิศ`)
        }
      >
        <span className="avatar-wrap">
          <Avatar appearance={member.appearance} seed={member.id} />
          <i
            className={isOnline ? '' : 'offline'}
            style={isOnline ? { background: status.color } : {}}
          />
        </span>
        <span className="member-copy">
          <strong>
            {member.name}
            {member.id === user.id && <small>คุณ</small>}
          </strong>
          <span>
            {!isOnline
              ? 'ออฟไลน์'
              : peer?.roomId
                ? snapshot.rooms.find((r) => r.id === peer.roomId)?.name
                : status.label}
          </span>
        </span>
        {isOnline && <ChevronRight size={14} />}
      </button>
    );
  };
  return (
    <div className="app-shell clean-office">
      <nav className="rail" aria-label="เมนูหลัก">
        <a className="rail-logo" href="/" aria-label="Assemble">
          <Leaf size={25} />
        </a>
        <div className="rail-main">
          <button
            className={`rail-button ${!sidebarOpen && !chatOpen ? 'active' : ''}`}
            title="ออฟฟิศ"
            aria-label="ออฟฟิศ"
            onClick={() => {
              setRoomPanel(null);
              setSidebarOpen(false);
              setZoom(1);
            }}
          >
            <Home size={21} />
          </button>
          <button
            className={`rail-button ${sidebarOpen && sidebar === 'people' ? 'soft-active' : ''}`}
            title="เพื่อนร่วมงาน"
            aria-label="เพื่อนร่วมงาน"
            aria-expanded={sidebarOpen && sidebar === 'people'}
            onClick={() => {
              setSidebar('people');
              setSidebarOpen(sidebar !== 'people' || !sidebarOpen);
            }}
          >
            <Users size={21} />
          </button>
          <button
            className={`rail-button ${sidebarOpen && sidebar === 'rooms' ? 'soft-active' : ''}`}
            title="ห้องประชุม"
            aria-label="ห้องประชุม"
            aria-expanded={sidebarOpen && sidebar === 'rooms'}
            onClick={() => {
              setSidebar('rooms');
              setSidebarOpen(sidebar !== 'rooms' || !sidebarOpen);
            }}
          >
            <DoorOpen size={21} />
          </button>
          <span className="rail-divider" />
          <button
            className={`rail-button ${chatOpen ? 'soft-active' : ''}`}
            title="แชต"
            aria-label="เปิดแชต"
            aria-expanded={chatOpen}
            onClick={toggleChat}
          >
            <MessageCircle size={21} />
            {unread > 0 && <i className="unread-dot" />}
          </button>
        </div>
        <div className="rail-bottom">
          <button
            className="rail-button"
            aria-label="วิธีใช้งาน"
            title="วิธีใช้งาน"
            onClick={() => setModal('help')}
          >
            <CircleHelp size={21} />
          </button>
          <button
            className="rail-button"
            aria-label="ตั้งค่า"
            title="ตั้งค่า"
            onClick={() => setModal('settings')}
          >
            <Settings size={21} />
          </button>
          <button
            className="rail-profile"
            aria-label="โปรไฟล์ของฉัน"
            onClick={() => {
              setSettingsTab('profile');
              setModal('settings');
            }}
          >
            <Avatar appearance={currentUser.appearance} seed={user.id} size={36} />
          </button>
        </div>
      </nav>
      <button
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        aria-label="ปิดรายชื่อเพื่อนร่วมงาน"
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="workspace-brand">
          <strong>{sidebar === 'people' ? 'เพื่อนร่วมงาน' : 'ห้องประชุม'}</strong>
          <button
            className="icon-button"
            aria-label="ปิดแถบรายชื่อ"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={17} />
          </button>
        </div>
        <div className="sidebar-tabs">
          <button
            className={sidebar === 'people' ? 'selected' : ''}
            onClick={() => setSidebar('people')}
          >
            เพื่อนร่วมงาน <span>{snapshot.peers.length}</span>
          </button>
          <button
            className={sidebar === 'rooms' ? 'selected' : ''}
            onClick={() => setSidebar('rooms')}
          >
            ห้องประชุม
          </button>
        </div>
        <div className="sidebar-scroll">
          {sidebar === 'people' ? (
            <>
              <label className="search-field">
                <Search size={16} />
                <input
                  aria-label="ค้นหาเพื่อนร่วมงาน"
                  placeholder="หาเพื่อนร่วมงาน…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <kbd>⌕</kbd>
              </label>
              <div className="list-heading">
                <span>ในออฟฟิศตอนนี้</span>
                <span>{user.role === 'guest' ? snapshot.peers.length : online.length}</span>
              </div>
              {user.role === 'guest'
                ? snapshot.peers.map((p) => memberRow(p, true))
                : online.map((m) => memberRow(m, true))}
              {!online.length && user.role !== 'guest' && (
                <p className="list-empty">
                  {search ? 'ไม่พบเพื่อนร่วมงานชื่อนี้' : 'กำลังเชื่อมต่อออฟฟิศ…'}
                </p>
              )}
              {!!offline.length && (
                <>
                  <div className="list-heading offline-heading">
                    <span>ยังไม่เข้าออฟฟิศ</span>
                    <span>{offline.length}</span>
                  </div>
                  {offline.map((m) => memberRow(m, false))}
                </>
              )}
            </>
          ) : (
            <>
              {snapshot.rooms.map((r) => (
                <button
                  key={r.id}
                  className={`sidebar-room-card ${r.id}`}
                  onClick={() => {
                    openRoom(r.id);
                    setSidebarOpen(false);
                  }}
                >
                  <div>
                    <DoorOpen size={22} />
                    <span>{r.count ? 'กำลังใช้งาน' : 'พร้อมใช้งาน'}</span>
                  </div>
                  <strong>{r.name}</strong>
                  <p>{r.subtitle}</p>
                  <footer>
                    <Users size={13} />
                    {r.count}/{r.capacity} คน
                    <ArrowUpRight size={17} />
                  </footer>
                </button>
              ))}
            </>
          )}
        </div>
        <div className="my-profile">
          <Avatar appearance={currentUser.appearance} seed={user.id} size={38} />
          <div>
            <strong>{user.name}</strong>
            <button onClick={() => setStatusOpen(!statusOpen)}>
              <i style={{ background: STATUSES[currentUser.status]?.color }} />
              {STATUSES[currentUser.status]?.label}
              <ChevronDown size={12} />
            </button>
          </div>
          <button
            className="icon-button"
            aria-label="ตั้งค่าโปรไฟล์"
            onClick={() => setModal('settings')}
          >
            <MoreHorizontal size={19} />
          </button>
        </div>
      </aside>
      <main className="main-office">
        <header className="topbar">
          <div className="space-tools">
            <div className="space-chip">
              <span className="space-logo">
                <Leaf size={18} />
              </span>
              <strong>{config.officeName}</strong>
              <LockKeyhole size={13} />
            </div>
            <button
              className="my-seat-button"
              aria-label="ไปที่นั่งของฉัน"
              title="ไปที่นั่งของฉัน"
              onClick={() => {
                send({ type: 'myseat' });
                setFocusedId(user.id);
              }}
            >
              <Navigation size={15} />
              <span>ที่นั่งของฉัน</span>
            </button>
          </div>
          <div className="topbar-actions">
            <button
              className="online-pill"
              title={connected ? 'ดูเพื่อนร่วมงานในออฟฟิศ' : 'กำลังเชื่อมต่อ'}
              onClick={() => {
                setSidebar('people');
                setSidebarOpen(!sidebarOpen || sidebar !== 'people');
              }}
            >
              <span className={connected ? 'live-dot' : 'empty-dot'} />
              <Users size={15} />
              <span>{snapshot.peers.length}</span>
            </button>
            {user.role !== 'guest' && (
              <button className="primary invite-top" onClick={() => openInvite()}>
                <Plus size={16} />
                เชิญเพื่อน
              </button>
            )}
          </div>
        </header>
        <div className="map-container">
          <OfficeMap
            snapshot={snapshot}
            send={send}
            zoom={zoom}
            setZoom={setZoom}
            focusedId={focusedId}
            onDesk={(id) => {
              setSelectedDesk(id);
              setModal('desk');
            }}
            onRoom={openRoom}
            reactions={reactions}
          />
          {config.demo && (
            <div className="local-badge">
              <span />
              {config.preview ? 'พรีวิวสำหรับทีม' : 'เดโมในเครื่อง'}
            </div>
          )}
          {!connected && (
            <div className="connection-banner" role="status">
              <LoaderCircle size={16} className={!connectionError ? 'spin' : ''} />
              {connectionError || 'กำลังเชื่อมต่อใหม่…'}
              {connectionError && <button onClick={logout}>เข้าสู่ระบบใหม่</button>}
            </div>
          )}
        </div>
        <footer className="office-footer">
          <span className="keyboard-tip">
            <Navigation size={13} />
            <span>WASD / ลูกศร หรือคลิกเพื่อเดิน</span>
          </span>
          <div className="control-dock">
            <button
              aria-label="เลือกสถานะ"
              title="เลือกสถานะ"
              className="dock-status"
              onClick={() => setStatusOpen(!statusOpen)}
            >
              <i style={{ background: STATUSES[currentUser.status]?.color }} />
              {STATUSES[currentUser.status]?.label}
              <ChevronDown size={12} />
            </button>
            <i className="dock-divider" />
            <button
              aria-label="ไมโครโฟน"
              title="ไมโครโฟนในห้องประชุม"
              onClick={() =>
                self?.roomId ? openRoom(self.roomId) : notify('เลือกห้องประชุมเพื่อเปิดไมโครโฟน')
              }
            >
              <MicOff size={19} />
            </button>
            <button
              aria-label="กล้อง"
              title="กล้องในห้องประชุม"
              onClick={() =>
                self?.roomId ? openRoom(self.roomId) : notify('เลือกห้องประชุมเพื่อเปิดกล้อง')
              }
            >
              <VideoOff size={19} />
            </button>
            <button
              aria-label="แชร์หน้าจอ"
              title="แชร์หน้าจอในห้องประชุม"
              onClick={() =>
                self?.roomId ? openRoom(self.roomId) : notify('เลือกห้องประชุมเพื่อแชร์หน้าจอ')
              }
            >
              <Monitor size={19} />
            </button>
            <i className="dock-divider" />
            <button
              aria-label="ส่งรีแอ็กชัน"
              title="ส่งรีแอ็กชัน"
              onClick={() => setReactionOpen(!reactionOpen)}
            >
              <Smile size={20} />
            </button>
            <button
              className="dock-leave"
              aria-label="ออกจากออฟฟิศ"
              title="ออกจากออฟฟิศ"
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
          <button className={`chat-launcher ${chatOpen ? 'selected' : ''}`} onClick={toggleChat}>
            <MessageCircle size={18} />
            แชตของทีม{unread > 0 ? <span>{unread}</span> : <ChevronRight size={15} />}
          </button>
        </footer>
      </main>
      {statusOpen && (
        <>
          <button
            className="popover-dismiss"
            aria-label="ปิดตัวเลือกสถานะ"
            onClick={() => setStatusOpen(false)}
          />
          <div className="status-menu">
            <span className="popover-label">ตอนนี้สะดวกแบบไหน?</span>
            {Object.entries(STATUSES).map(([id, s]) => (
              <button
                key={id}
                disabled={user.role === 'guest'}
                onClick={() => {
                  send({ type: 'status', status: id });
                  setStatusOpen(false);
                }}
              >
                <i style={{ background: s.color }} />
                {s.label}
                {currentUser.status === id && <Check size={15} />}
              </button>
            ))}
          </div>
        </>
      )}
      {reactionOpen && (
        <>
          <button
            className="popover-dismiss"
            aria-label="ปิดรีแอ็กชัน"
            onClick={() => setReactionOpen(false)}
          />
          <div className="reaction-menu">
            {['👋', '💚', '✨', '☕', '👏'].map((emoji) => (
              <button
                key={emoji}
                aria-label={`ส่ง ${emoji}`}
                onClick={() => {
                  send({ type: 'reaction', emoji });
                  setReactionOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
      {chatOpen && (
        <section className="chat-panel" aria-label="แชตของทีม">
          <div className="panel-heading">
            <span>
              <MessageCircle size={18} />
              <strong>คุยกับทีม</strong>
            </span>
            <button className="icon-button" onClick={() => setChatOpen(false)} aria-label="ปิดแชต">
              <X size={18} />
            </button>
          </div>
          <div className="chat-tabs">
            {user.role !== 'guest' && (
              <button
                className={channel === 'general' ? 'active' : ''}
                onClick={() => selectChannel('general')}
              >
                พื้นที่ส่วนกลาง
              </button>
            )}
            {currentRoom && (
              <button
                className={channel === currentRoom.id ? 'active' : ''}
                onClick={() => selectChannel(currentRoom.id)}
              >
                {currentRoom.name}
              </button>
            )}
          </div>
          <div ref={chatRef} className="chat-messages">
            {!messages[channel]?.length && (
              <div className="empty-chat">
                <span>☕</span>
                <h3>บทสนทนาดี ๆ เริ่มจากคำทักทาย</h3>
                <p>ลองพิมพ์ “สวัสดี” ให้ทีมรู้ว่าคุณมาแล้ว</p>
              </div>
            )}
            {messages[channel]?.map((m) => (
              <div className={`chat-message ${m.senderId === user.id ? 'own' : ''}`} key={m.id}>
                <Avatar
                  appearance={
                    snapshot.peers.find((p) => p.id === m.senderId)?.appearance ??
                    snapshot.directory.find((p) => p.id === m.senderId)?.appearance ??
                    m.appearance
                  }
                  seed={m.senderId}
                  size={28}
                />
                <div>
                  <div className="message-meta">
                    <strong>{m.name}</strong>
                    <time>{time(m.createdAt)}</time>
                  </div>
                  <p>{m.text}</p>
                </div>
              </div>
            ))}
          </div>
          <form
            className="chat-compose"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim() && connected) {
                send({ type: 'chat', channel, text: draft });
                setDraft('');
              }
            }}
          >
            <input
              aria-label="ข้อความแชต"
              placeholder="พิมพ์ข้อความถึงทีม…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={1500}
              disabled={!connected}
            />
            <button disabled={!draft.trim() || !connected} aria-label="ส่งข้อความ">
              <ArrowUpRight size={20} />
            </button>
          </form>
          <div className="retention-note">
            <LockKeyhole size={11} />
            ข้อความเก็บไว้ 30 วัน
          </div>
        </section>
      )}
      {selectedRoom && (
        <section
          className={`room-panel ${media ? 'with-media' : ''}`}
          aria-label={selectedRoom.name}
        >
          <div className={`room-cover ${selectedRoom.id}`}>
            <div className="room-cover-circle" />
            <button
              className="close-room icon-button"
              onClick={() => setRoomPanel(null)}
              aria-label="ปิดรายละเอียดห้อง"
            >
              <X size={19} />
            </button>
            <DoorOpen size={32} />
            <h2>{selectedRoom.name}</h2>
            <p>{selectedRoom.subtitle}</p>
          </div>
          <div className="room-panel-body">
            <div className="room-facts">
              <span>
                <Users size={15} />
                {selectedRoom.count}/{selectedRoom.capacity} คน
              </span>
              <span>
                <LockKeyhole size={14} />
                เฉพาะผู้เข้าห้อง
              </span>
            </div>
            <div className="room-attendees">
              {snapshot.peers
                .filter((p) => p.roomId === selectedRoom.id)
                .map((p) => (
                  <div key={p.id}>
                    <Avatar appearance={p.appearance} seed={p.id} />
                    <span>{p.name}</span>
                  </div>
                ))}
              {!selectedRoom.count && <p>ห้องว่างอยู่ ชวนทีมมานั่งคุยกันได้เลย</p>}
            </div>
            {self?.roomId !== selectedRoom.id ? (
              <button
                className="primary full-width"
                disabled={
                  !connected ||
                  selectedRoom.count >= selectedRoom.capacity ||
                  (user.role === 'guest' && user.roomScope !== selectedRoom.id)
                }
                onClick={() => send({ type: 'join', roomId: selectedRoom.id })}
              >
                เข้าห้องประชุม
                <ArrowRight size={17} />
              </button>
            ) : (
              <>
                <div className="room-joined">
                  <span className="live-dot" />
                  คุณอยู่ในห้องนี้แล้ว
                  <Check size={16} />
                </div>
                {media?.roomId === selectedRoom.id ? (
                  <Suspense fallback={<p>กำลังเตรียมห้องประชุม…</p>}>
                    <Meeting
                      token={media.token}
                      url={media.url}
                      onDisconnect={() => setMedia(null)}
                      onError={notify}
                    />
                  </Suspense>
                ) : (
                  <>
                    <button
                      className="primary full-width"
                      disabled={mediaBusy || !config.mediaEnabled}
                      onClick={joinMedia}
                    >
                      {mediaBusy ? (
                        <LoaderCircle className="spin" size={17} />
                      ) : (
                        <Headphones size={17} />
                      )}
                      เชื่อมต่อเสียงและวิดีโอ
                    </button>
                    {!config.mediaEnabled && (
                      <div className="media-unavailable">
                        <Info size={16} />
                        <span>
                          ยังไม่ได้เชื่อมบริการประชุม
                          <br />
                          <small>
                            แชตในห้องใช้ได้แล้ว ผู้ดูแลเปิดเสียง วิดีโอ
                            และแชร์หน้าจอได้หลังเชื่อมบริการ
                          </small>
                        </span>
                      </div>
                    )}
                  </>
                )}
                <button
                  className="secondary full-width"
                  onClick={() => {
                    selectChannel(selectedRoom.id);
                    setChatOpen(true);
                    setRoomPanel(null);
                    setUnread(0);
                  }}
                >
                  <MessageCircle size={16} />
                  เปิดแชตห้องนี้
                </button>
                {user.role !== 'guest' && (
                  <button
                    className="text-button leave-room"
                    onClick={() => {
                      send({ type: 'leave' });
                      setMedia(null);
                    }}
                  >
                    <DoorOpen size={15} />
                    กลับพื้นที่ส่วนกลาง
                  </button>
                )}
              </>
            )}
            {user.role !== 'guest' && (
              <button className="room-invite-link" onClick={() => openInvite(selectedRoom.id)}>
                <Link size={15} />
                สร้างคำเชิญเข้าห้องนี้
                <ArrowUpRight size={14} />
              </button>
            )}
            <p className="room-footnote">
              เริ่มประชุมด้วยไมค์และกล้องที่ปิดอยู่
              <br />
              คุณเลือกเปิดอุปกรณ์ได้เมื่อพร้อม
            </p>
          </div>
        </section>
      )}
      {modal === 'invite' && (
        <Dialog title="ชวนมาคุยกัน" onClose={() => setModal(null)}>
          <p className="dialog-description">
            ส่งคำเชิญให้แขกเข้าห้องประชุมที่เลือก
            <br />
            ลิงก์ใช้ได้ 24 ชั่วโมง
          </p>
          <label className="field-label" htmlFor="invite-room">
            ห้องประชุม
          </label>
          <select
            id="invite-room"
            value={inviteRoom}
            onChange={(e) => {
              setInviteRoom(e.target.value);
              setInviteUrl('');
            }}
          >
            {snapshot.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {inviteUrl ? (
            <div className="invite-result">
              <label htmlFor="invite-url">ลิงก์เชิญพร้อมแล้ว</label>
              <div>
                <input
                  id="invite-url"
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.target.select()}
                />
                <button className="primary" onClick={copy}>
                  {copied ? <Check size={17} /> : <Copy size={17} />}
                </button>
              </div>
              <p>
                <ShieldCheck size={13} />
                แขกเข้าถึงได้เฉพาะห้องที่ได้รับเชิญ
              </p>
            </div>
          ) : (
            <button
              className="primary full-width spaced"
              disabled={inviteBusy}
              onClick={createInvite}
            >
              {inviteBusy ? <LoaderCircle className="spin" size={17} /> : <Link size={17} />}
              สร้างลิงก์คำเชิญ
            </button>
          )}
          {invites.filter((i) => !i.revoked).length > 0 && (
            <div className="active-invites">
              <h3>คำเชิญที่ยังใช้ได้</h3>
              {invites
                .filter((i) => !i.revoked)
                .map((i) => (
                  <div key={i.id}>
                    <span>
                      {ROOMS.find((r) => r.id === i.roomId)?.name}
                      <small>
                        หมดอายุ{' '}
                        {new Date(i.expiresAt).toLocaleString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </small>
                    </span>
                    <button
                      onClick={async () => {
                        try {
                          await api(`/api/invites/${i.id}`, {}, 'DELETE');
                          setInvites((await api('/api/invites')).invites);
                          setInviteUrl('');
                          notify('ยกเลิกคำเชิญแล้ว');
                        } catch (e) {
                          notify((e as Error).message);
                        }
                      }}
                    >
                      ยกเลิก
                    </button>
                  </div>
                ))}
            </div>
          )}
        </Dialog>
      )}
      {modal === 'desk' && (
        <Dialog title={`ที่นั่ง ${selectedDesk}`} onClose={() => setModal(null)}>
          <div className="seat-illustration">
            <Monitor size={52} />
            <span>MAKE YOURSELF AT HOME</span>
          </div>
          {(() => {
            const owner = snapshot.directory.find((m) => m.seat === selectedDesk);
            return (
              <>
                <p className="dialog-description">
                  {owner
                    ? `ที่นั่งประจำของ ${owner.name}`
                    : 'ยังว่างอยู่ เลือกมุมนี้เป็นที่นั่งประจำของคุณได้เลย'}
                </p>
                <button
                  className="primary full-width"
                  disabled={user.role === 'guest' || (!!owner && owner.id !== user.id)}
                  onClick={() => {
                    if (owner?.id !== user.id) send({ type: 'seat', seat: selectedDesk });
                    else send({ type: 'myseat' });
                    setModal(null);
                  }}
                >
                  {owner?.id === user.id
                    ? 'ไปที่นั่งของฉัน'
                    : owner
                      ? 'มีเจ้าของแล้ว'
                      : 'เลือกเป็นที่นั่งของฉัน'}
                  <ArrowRight size={16} />
                </button>
              </>
            );
          })()}
        </Dialog>
      )}
      {modal === 'help' && (
        <Dialog title="ทำตัวตามสบาย เหมือนอยู่ออฟฟิศ" onClose={() => setModal(null)}>
          <div className="help-list">
            <div>
              <Navigation size={22} />
              <span>
                <strong>เดินไปหาทีม</strong>คลิกพื้นหรือใช้ปุ่มลูกศร / WASD เพื่อเดิน
              </span>
            </div>
            <div>
              <Monitor size={22} />
              <span>
                <strong>มีมุมของตัวเอง</strong>คลิกโต๊ะเพื่อเลือกที่นั่งประจำ แล้วกด
                “ไปที่นั่งของฉัน”
              </span>
            </div>
            <div>
              <DoorOpen size={22} />
              <span>
                <strong>นัดคุยในห้อง</strong>คลิกชื่อห้องแล้วเข้าประชุม หรือเดินผ่านประตูเข้าไป
              </span>
            </div>
            <div>
              <Smile size={22} />
              <span>
                <strong>ทักทายกันสักนิด</strong>ส่งรีแอ็กชัน แชต หรือเปลี่ยนสถานะเมื่อต้องการโฟกัส
              </span>
            </div>
          </div>
          <p className="dialog-description">
            ผู้ใช้ที่ออนไลน์คือผู้ที่เปิดเซสชันจริง
            ทดลองพบกันได้โดยเปิดหน้าต่างไม่ระบุตัวตนแล้วเข้าออฟฟิศด้วยอีกชื่อหนึ่ง
          </p>
        </Dialog>
      )}
      {modal === 'settings' && (
        <Dialog
          title="พื้นที่ของคุณ"
          wide
          onClose={() => {
            setModal(null);
            setConfirmRevoke(null);
          }}
        >
          <div className="settings-tabs">
            {[
              ['profile', 'โปรไฟล์'],
              ['office', 'สำนักงาน'],
              ...(user.role === 'admin' ? [['admin', 'ดูแลสมาชิก']] : []),
            ].map(([id, label]) => (
              <button
                key={id}
                className={settingsTab === id ? 'active' : ''}
                onClick={() => setSettingsTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {settingsTab === 'profile' && (
            <>
              <div className="settings-profile">
                <Avatar appearance={currentUser.appearance} seed={user.id} size={72} />
                <div>
                  <h3>{user.name}</h3>
                  <p>
                    {user.email ||
                      (user.role === 'guest' ? 'ผู้เยี่ยมชมที่ได้รับเชิญ' : 'บัญชีทดลองในเครื่อง')}
                  </p>
                  <span className="role-badge">
                    {user.role === 'admin'
                      ? 'ผู้ดูแลสำนักงาน'
                      : user.role === 'guest'
                        ? 'ผู้เยี่ยมชม'
                        : 'สมาชิกองค์กร'}
                  </span>
                </div>
              </div>
              <CharacterEditor
                user={currentUser}
                onSaved={(appearance) => {
                  setSnapshot((old) => ({
                    ...old,
                    peers: old.peers.map((p) => (p.id === user.id ? { ...p, appearance } : p)),
                    directory: old.directory.map((p) =>
                      p.id === user.id ? { ...p, appearance } : p,
                    ),
                  }));
                }}
              />
              <div className="settings-line">
                <span>สถานะของฉัน</span>
                <strong>
                  {STATUSES[currentUser.status]?.emoji} {STATUSES[currentUser.status]?.label}
                </strong>
              </div>
              <div className="settings-line">
                <span>ที่นั่งประจำ</span>
                <strong>
                  {currentUser.seat ? `DESK ${currentUser.seat}` : 'เลือกได้จากแผนที่'}
                </strong>
              </div>
              <button className="secondary full-width spaced" onClick={logout}>
                <LogOut size={16} />
                ออกจากออฟฟิศ
              </button>
            </>
          )}
          {settingsTab === 'office' && (
            <>
              <div className="settings-office-title">
                <span className="workspace-icon">
                  <Home size={22} />
                </span>
                <div>
                  <h3>{config.officeName}</h3>
                  <p>{config.orgName} · ออฟฟิศเสมือนของทีม</p>
                </div>
              </div>
              {[
                [
                  'รูปแบบใช้งาน',
                  config.preview
                    ? 'พรีวิวสำหรับทีม'
                    : config.demo
                      ? 'เดโมในเครื่อง'
                      : 'สำนักงานองค์กร',
                ],
                [
                  'บัญชีบริษัท',
                  config.providers.length ? config.providers.join(' / ') : 'รอเชื่อมบัญชีองค์กร',
                ],
                [
                  'เสียง วิดีโอ แชร์หน้าจอ',
                  config.mediaEnabled ? 'เชื่อมบริการประชุมแล้ว' : 'รอเชื่อมบริการประชุม',
                ],
                ['จำนวนออนไลน์สูงสุด', `${config.maxOnline} คน`],
                ['ผู้ร่วมประชุมต่อห้อง', `${config.roomCapacity} คน`],
                ['ประวัติแชต', '30 วัน'],
                ['บันทึกเสียงและวิดีโอ', 'ปิดใช้งาน'],
              ].map(([label, value]) => (
                <div className="settings-line" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </>
          )}
          {settingsTab === 'admin' && (
            <>
              <p className="dialog-description">
                ผู้ดูแลถอนสิทธิ์สมาชิกได้ เซสชันและคำเชิญที่สร้างโดยสมาชิกนั้นจะถูกยกเลิก
              </p>
              {snapshot.directory.map((m) => (
                <div className="admin-member" key={m.id}>
                  <Avatar appearance={m.appearance} seed={m.id} size={34} />
                  <span>
                    <strong>{m.name}</strong>
                    <small>{m.email || 'บัญชีทดลอง'}</small>
                  </span>
                  {m.id !== user.id && (
                    <button className="danger-text" onClick={() => setConfirmRevoke(m)}>
                      ถอนสิทธิ์
                    </button>
                  )}
                  {m.id === user.id && <span className="role-badge">คุณ</span>}
                </div>
              ))}
              {confirmRevoke && (
                <div className="confirm-revoke">
                  <p>
                    ถอนสิทธิ์ <strong>{confirmRevoke.name}</strong> จากสำนักงาน?
                  </p>
                  <button className="secondary" onClick={() => setConfirmRevoke(null)}>
                    กลับ
                  </button>
                  <button
                    className="danger"
                    onClick={async () => {
                      try {
                        await api(`/api/members/${confirmRevoke.id}/revoke`, {});
                        setConfirmRevoke(null);
                        notify('ถอนสิทธิ์สมาชิกแล้ว');
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    }}
                  >
                    ยืนยันถอนสิทธิ์
                  </button>
                </div>
              )}
            </>
          )}
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <Info size={17} />
          {toast}
          <button onClick={() => setToast('')} aria-label="ปิดข้อความ">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
