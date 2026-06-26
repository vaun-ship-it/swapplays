import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Image,
  ImageBackground,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  Vibration,
  View
} from "react-native";
import { storageBuckets, supabase, tables } from "./lib/supabase";

type PlatformKind = "audio";
type TabName = "campaigns" | "play" | "leaderboard" | "redeem" | "invite" | "how" | "awards";
type MediaKind = "audio" | "video";
type MediaCategory = "Music" | "Podcast" | "Food" | "Sports" | "Gaming" | "Comedy" | "Other";

type LoginCredentials = {
  email: string;
  password: string;
  name?: string;
  isCreate: boolean;
};

type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  points: number | null;
  overall_points: number | null;
  profile_photo_url: string | null;
  profile_link: string | null;
  autoplay_active: boolean | null;
  autoplay_plan: string | null;
  autoplay_expires_at: string | null;
};

type CampaignRow = {
  id: string;
  user_id: string;
  owner_email: string | null;
  title: string;
  category: string;
  media_url: string;
  media_kind: string;
  thumbnail_url: string | null;
  external_link: string | null;
  plays_target: number;
  seconds_target: number;
  points_cost: number;
  plays_done: number;
  created_at: string;
};

type CampaignDraft = Omit<Campaign, "id" | "artist" | "platform" | "playsDone" | "createdAt"> & {
  mediaFile?: File;
};

type AutoplayPlanId = "week" | "month" | "plus";

type Campaign = {
  id: string;
  title: string;
  artist: string;
  category: MediaCategory;
  url: string;
  mediaKind: MediaKind;
  thumbnailUrl?: string;
  externalLink?: string;
  ownerEmail?: string;
  platform: PlatformKind;
  playsTarget: number;
  secondsTarget: number;
  pointsCost: number;
  playsDone: number;
  createdAt: string;
};

type PlaqueTier = "gold" | "platinum" | "diamond";

type PlaqueAward = {
  tier: PlaqueTier;
  label: string;
  points: number;
  image: number;
  key: number;
};

const platformMeta: Record<PlatformKind, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  audio: { label: "Media", color: "#050505", icon: "link" }
};

const mediaCategories: MediaCategory[] = ["Music", "Podcast", "Food", "Sports", "Gaming", "Comedy", "Other"];
const primaryTabs: TabName[] = ["campaigns", "play", "leaderboard"];
const watchAdsControllerEmail = "cavauntechnologies@gmail.com";
const regularMediaFundedEmail = "drekray@gmail.com";
const regularMediaFundedPoints = 100000000;

const starterCampaigns: Campaign[] = [
  {
    id: "c1",
    title: "Sample Media Campaign",
    artist: "Media",
    category: "Music",
    url: "https://example.com/audio.mp3",
    mediaKind: "audio",
    externalLink: "https://example.com",
    platform: "audio",
    playsTarget: 10,
    secondsTarget: 45,
    pointsCost: 450,
    playsDone: 0,
    createdAt: "2026-06-11 09:28"
  },
  {
    id: "c2",
    title: "Creator Media Promo",
    artist: "Media",
    category: "Podcast",
    url: "https://example.com/creator-track.mp3",
    mediaKind: "audio",
    externalLink: "https://example.com",
    platform: "audio",
    playsTarget: 50,
    secondsTarget: 60,
    pointsCost: 3000,
    playsDone: 0,
    createdAt: "2026-06-10 15:40"
  }
];

const appAdCampaigns: Campaign[] = [
  {
    id: "swap-ad-1",
    title: "Creator Media Promo",
    artist: "Swap Plays Ad",
    category: "Other",
    url: "https://example.com/creator-track.mp3",
    mediaKind: "audio",
    externalLink: "https://swapplays.app",
    platform: "audio",
    playsTarget: 1,
    secondsTarget: 60,
    pointsCost: 0,
    playsDone: 0,
    createdAt: "2026-06-17 09:30"
  },
  {
    id: "swap-ad-2",
    title: "Sample Media Campaign",
    artist: "Swap Plays Ad",
    category: "Other",
    url: "https://example.com/audio.mp3",
    mediaKind: "audio",
    externalLink: "https://swapplays.app",
    platform: "audio",
    playsTarget: 1,
    secondsTarget: 45,
    pointsCost: 0,
    playsDone: 0,
    createdAt: "2026-06-17 09:31"
  }
];

const playOptions = [10, ...Array.from({ length: 200000 }, (_, index) => (index + 1) * 50)];
const secondOptions = [45, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420, 450, 480, 510, 540, 570, 600];

const plaqueMilestones: Omit<PlaqueAward, "key">[] = [
  { tier: "gold", label: "500K GOLD Badge", points: 500000, image: require("./assets/plaque-gold.png") },
  { tier: "platinum", label: "1 Million PLATINUM Badge", points: 1000000, image: require("./assets/plaque-platinum.png") },
  { tier: "diamond", label: "10 Million DIAMOND Badge", points: 10000000, image: require("./assets/plaque-diamond.png") }
];

function isLikelyUrl(value: string) {
  return /^https?:\/\/[^\s]+\.[^\s]+/i.test(value.trim());
}

function isInstagramUrl(value: string) {
  return /instagram\.com\/(p|reel|tv)\//i.test(value.trim());
}

function pointCost(plays: number, seconds: number) {
  return plays * seconds;
}

function earningFor(seconds: number) {
  const variance = Math.max(4, Math.floor(seconds * 0.12));
  return Math.max(1, seconds - variance);
}

function normalizeCategory(value: string): MediaCategory {
  return mediaCategories.includes(value as MediaCategory) ? (value as MediaCategory) : "Other";
}

function formatCampaignDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 16).replace("T", " ");
}

function campaignFromRow(row: CampaignRow): Campaign {
  return {
    id: row.id,
    title: row.title,
    artist: "Media",
    ownerEmail: row.owner_email || undefined,
    category: normalizeCategory(row.category),
    url: row.media_url,
    mediaKind: row.media_kind === "video" ? "video" : "audio",
    thumbnailUrl: row.thumbnail_url || undefined,
    externalLink: row.external_link || undefined,
    platform: "audio",
    playsTarget: row.plays_target,
    secondsTarget: row.seconds_target,
    pointsCost: row.points_cost,
    playsDone: row.plays_done,
    createdAt: formatCampaignDate(row.created_at)
  };
}

function badgeForPoints(points: number) {
  if (points >= 10000000) return "diamond";
  if (points >= 1000000) return "platinum";
  if (points >= 500000) return "gold";
  return "coin";
}

function createVideoThumbnail(url: string): Promise<string> {
  if (Platform.OS !== "web") return Promise.resolve("");
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.crossOrigin = "anonymous";

    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
    };

    video.onerror = () => {
      cleanup();
      resolve("");
    };

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.2, Math.max(0, video.duration || 0));
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const width = video.videoWidth || 320;
        const height = video.videoHeight || 180;
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          cleanup();
          resolve("");
          return;
        }
        context.drawImage(video, 0, 0, width, height);
        cleanup();
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      } catch {
        cleanup();
        resolve("");
      }
    };
  });
}

function getMediaSource(url: string, mediaKind: MediaKind = "audio") {
  const trimmed = url.trim();
  const spotifyMatch = trimmed.match(/open\.spotify\.com\/(track|album|playlist|artist|episode|show)\/([^?/#]+)/i);
  if (spotifyMatch) {
    return {
      kind: "embed",
      url: `https://open.spotify.com/embed/${spotifyMatch[1]}/${spotifyMatch[2]}`
    };
  }

  if (/soundcloud\.com/i.test(trimmed)) {
    return {
      kind: "embed",
      url: `https://w.soundcloud.com/player/?url=${encodeURIComponent(trimmed)}&auto_play=true&visual=true`
    };
  }

  if (/music\.apple\.com/i.test(trimmed)) {
    return {
      kind: "embed",
      url: trimmed.replace("https://music.apple.com", "https://embed.music.apple.com").replace("http://music.apple.com", "https://embed.music.apple.com")
    };
  }

  if (/itunes\.apple\.com/i.test(trimmed)) {
    return {
      kind: "embed",
      url: trimmed.replace("https://itunes.apple.com", "https://embed.music.apple.com").replace("http://itunes.apple.com", "https://embed.music.apple.com")
    };
  }

  const tiktokId = trimmed.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i)?.[1];
  if (tiktokId) {
    return {
      kind: "embed",
      url: `https://www.tiktok.com/embed/v2/${tiktokId}`
    };
  }

  const instagramMatch = trimmed.match(/instagram\.com\/(p|reel|tv)\/([^/?#]+)/i);
  if (instagramMatch) {
    return {
      kind: "restricted",
      url: trimmed
    };
  }

  const youtubeId =
    trimmed.match(/youtu\.be\/([^?&/]+)/i)?.[1] ||
    trimmed.match(/[?&]v=([^?&/]+)/i)?.[1] ||
    trimmed.match(/youtube\.com\/shorts\/([^?&/]+)/i)?.[1];
  if (youtubeId) {
    return {
      kind: "embed",
      url: `https://www.youtube.com/embed/${youtubeId}?autoplay=1&playsinline=1&rel=0`
    };
  }
  if (/^blob:/i.test(trimmed)) {
    return { kind: mediaKind, url: trimmed };
  }
  if (/\.(mp3|m4a|aac|wav|ogg)(\?|#|$)/i.test(trimmed)) {
    return { kind: "audio", url: trimmed };
  }
  if (/\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(trimmed)) {
    return { kind: "video", url: trimmed };
  }
  return { kind: "embed", url: trimmed };
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [userId, setUserId] = useState("");
  const [tab, setTab] = useState<TabName>("campaigns");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [autoplayModal, setAutoplayModal] = useState(false);
  const [campaigns, setCampaigns] = useState(starterCampaigns);
  const [points, setPoints] = useState(0);
  const [overallPoints, setOverallPoints] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [autoplayPlan, setAutoplayPlan] = useState<string | null>(null);
  const [autoplayExpiresAt, setAutoplayExpiresAt] = useState("");
  const [paypalNotice, setPaypalNotice] = useState("");
  const [activeCampaignIndex, setActiveCampaignIndex] = useState(0);
  const [watchAdsMode, setWatchAdsMode] = useState(false);
  const [adCampaignIndex, setAdCampaignIndex] = useState(0);
  const [playSequence, setPlaySequence] = useState(0);
  const [celebration, setCelebration] = useState<{ label: string; key: number } | null>(null);
  const [battlePairIds, setBattlePairIds] = useState<[string, string] | null>(null);
  const [pointsNotice, setPointsNotice] = useState("");
  const [plaqueAward, setPlaqueAward] = useState<PlaqueAward | null>(null);
  const [profileName, setProfileName] = useState("Swap Plays User");
  const [profileEmail, setProfileEmail] = useState("creator@example.com");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [profileLink, setProfileLink] = useState("");
  const [selectedPlayCategories, setSelectedPlayCategories] = useState<MediaCategory[]>(mediaCategories);
  const playableCampaigns = campaigns.filter((campaign) => campaign.playsDone < campaign.playsTarget && selectedPlayCategories.includes(campaign.category));
  const activeCampaign = playableCampaigns.length > 0 ? playableCampaigns[activeCampaignIndex % playableCampaigns.length] : undefined;
  const controllerAdCampaigns = campaigns.filter((campaign) => campaign.playsDone < campaign.playsTarget && campaign.ownerEmail?.trim().toLowerCase() === watchAdsControllerEmail);
  const adCampaigns = controllerAdCampaigns.length > 0 ? controllerAdCampaigns : appAdCampaigns;
  const activeAdCampaign = adCampaigns[adCampaignIndex % adCampaigns.length];
  const playCampaign = watchAdsMode ? activeAdCampaign : activeCampaign;
  const hasAutoplayAccess = Boolean(autoplayExpiresAt && Date.parse(autoplayExpiresAt) > Date.now());
  const hasUnlimitedCampaignPoints = profileEmail.trim().toLowerCase() === watchAdsControllerEmail;
  const battleCampaigns = battlePairIds
    ? battlePairIds
        .map((id) => playableCampaigns.find((campaign) => campaign.id === id))
        .filter((campaign): campaign is Campaign => Boolean(campaign))
    : [];
  const badge = badgeForPoints(overallPoints);

  const headerTitle = tab === "campaigns" ? "Swap Plays" : tab === "play" ? (watchAdsMode ? "Watch Ads" : "Play") : tab === "leaderboard" ? "Leaderboard" : tab === "redeem" ? "Redeem Points" : tab === "invite" ? "Invite Friends" : tab === "awards" ? "Awards" : "How It Works";

  function applyProfile(profile: ProfileRow | null, fallbackEmail: string, fallbackName?: string) {
    const profileEmailValue = profile?.email || fallbackEmail || "";
    const normalizedEmail = profileEmailValue.trim().toLowerCase();
    const profilePoints = profile?.points ?? 0;
    const profileOverallPoints = profile?.overall_points ?? 0;
    const isRegularMediaFundedAccount = normalizedEmail === regularMediaFundedEmail;

    setProfileEmail(profileEmailValue);
    setProfileName(profile?.name || fallbackName || profileEmailValue.split("@")[0] || "Swap Plays User");
    setPoints(isRegularMediaFundedAccount ? Math.max(profilePoints, regularMediaFundedPoints) : profilePoints);
    setOverallPoints(isRegularMediaFundedAccount ? Math.max(profileOverallPoints, regularMediaFundedPoints) : profileOverallPoints);
    setProfilePhoto(profile?.profile_photo_url || "");
    setProfileLink(profile?.profile_link || "");
    setAutoplayPlan(profile?.autoplay_plan || null);
    setAutoplayExpiresAt(profile?.autoplay_expires_at || "");
    setAutoplay(Boolean(profile?.autoplay_active && profile?.autoplay_expires_at && Date.parse(profile.autoplay_expires_at) > Date.now()));
  }

  async function loadOrCreateProfile(user: { id: string; email?: string | null }, fallbackName?: string) {
    const email = user.email || "";
    const profileColumns = "id,email,name,points,overall_points,profile_photo_url,profile_link,autoplay_active,autoplay_plan,autoplay_expires_at";
    const { data, error } = await supabase
      .from(tables.profiles)
      .select(profileColumns)
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();

    if (error) throw error;

    if (data) {
      setUserId(user.id);
      applyProfile(data, email, fallbackName);
      return;
    }

    const name = fallbackName?.trim() || email.split("@")[0] || "Swap Plays User";
    const { data: insertedProfile, error: insertError } = await supabase
      .from(tables.profiles)
      .insert({
        id: user.id,
        email,
        name,
        points: 0,
        overall_points: 0
      })
      .select(profileColumns)
      .single<ProfileRow>();

    if (insertError) throw insertError;
    setUserId(user.id);
    applyProfile(insertedProfile, email, name);
  }

  async function loadCampaigns() {
    const { data, error } = await supabase
      .from(tables.campaigns)
      .select("id,user_id,owner_email,title,category,media_url,media_kind,thumbnail_url,external_link,plays_target,seconds_target,points_cost,plays_done,created_at")
      .order("created_at", { ascending: false })
      .returns<CampaignRow[]>();

    if (error) throw error;
    setCampaigns((data || []).map(campaignFromRow));
  }

  async function createCampaign(draft: CampaignDraft) {
    if (!userId) return "Log in again before creating a campaign.";

    let mediaUrl = draft.url;
    if (draft.mediaFile) {
      const safeName = draft.mediaFile.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
      const storagePath = `${userId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(storageBuckets.mediaUploads)
        .upload(storagePath, draft.mediaFile, {
          contentType: draft.mediaFile.type || undefined,
          upsert: false
        });

      if (uploadError) return uploadError.message;
      const { data } = supabase.storage.from(storageBuckets.mediaUploads).getPublicUrl(storagePath);
      mediaUrl = data.publicUrl;
    }

    const { data, error } = await supabase
      .from(tables.campaigns)
      .insert({
        user_id: userId,
        owner_email: profileEmail.trim().toLowerCase(),
        title: draft.title,
        category: draft.category,
        media_url: mediaUrl,
        media_kind: draft.mediaKind,
        thumbnail_url: draft.thumbnailUrl || null,
        external_link: draft.externalLink || null,
        plays_target: draft.playsTarget,
        seconds_target: draft.secondsTarget,
        points_cost: draft.pointsCost,
        plays_done: 0
      })
      .select("id,user_id,owner_email,title,category,media_url,media_kind,thumbnail_url,external_link,plays_target,seconds_target,points_cost,plays_done,created_at")
      .single<CampaignRow>();

    if (error) return error.message;
    setCampaigns((items) => [campaignFromRow(data), ...items]);
    if (!hasUnlimitedCampaignPoints) {
      setPoints((value) => value - draft.pointsCost);
    }
    setCreateOpen(false);
    setTab("campaigns");
    return "";
  }

  async function deleteCampaign(id: string) {
    setCampaigns((items) => items.filter((item) => item.id !== id));
    const { error } = await supabase.from(tables.campaigns).delete().eq("id", id);
    if (error) {
      setAuthError(error.message);
      await loadCampaigns();
    }
  }

  function persistCampaignPlay(campaign: Campaign, nextPlaysDone: number, pointsEarned: number) {
    supabase
      .from(tables.campaigns)
      .update({ plays_done: nextPlaysDone })
      .eq("id", campaign.id)
      .then(({ error }) => {
        if (error) setAuthError(error.message);
      });

    if (!userId) return;
    supabase
      .from(tables.playHistory)
      .insert({
        user_id: userId,
        campaign_id: campaign.id,
        points_earned: pointsEarned,
        seconds_completed: campaign.secondsTarget
      })
      .then(({ error }) => {
        if (error) setAuthError(error.message);
      });
  }

  async function startPayPalCheckout(plan: AutoplayPlanId) {
    if (Platform.OS !== "web") {
      Alert.alert("PayPal checkout", "PayPal checkout is available on the website.");
      return "PayPal checkout is available on the website.";
    }
    if (!userId) {
      return "Log in before buying Autoplay.";
    }

    setPaypalNotice("");
    const response = await fetch("/api/paypal/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan,
        userId,
        origin: window.location.origin
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      return payload.error || "Could not start PayPal checkout.";
    }
    window.location.href = payload.approvalUrl;
    return "";
  }

  async function capturePayPalOrder(orderId: string) {
    const response = await fetch("/api/paypal/capture-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not confirm PayPal payment.");
    }
    setAutoplay(true);
    setAutoplayPlan(payload.plan || null);
    setAutoplayExpiresAt(payload.autoplayExpiresAt || "");
    setAutoplayModal(false);
    setPaypalNotice("Autoplay is active.");
    Alert.alert("Autoplay enabled", "Your PayPal payment was confirmed and Autoplay is active.");
  }

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      setAuthError("");
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        setAuthError(error.message);
        setAuthLoading(false);
        return;
      }

      const user = data.session?.user;
      if (!user) {
        setAuthLoading(false);
        return;
      }

      try {
        await loadOrCreateProfile(user);
        await loadCampaigns();
        if (active) setIsLoggedIn(true);
      } catch (profileError) {
        const message = profileError instanceof Error ? profileError.message : "Could not load your profile.";
        if (active) setAuthError(message);
      } finally {
        if (active) setAuthLoading(false);
      }
    }

    restoreSession();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setIsLoggedIn(false);
        setUserId("");
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    const timeout = setTimeout(() => {
      supabase
        .from(tables.profiles)
        .update({
          name: profileName.trim() || "Swap Plays User",
          points,
          overall_points: overallPoints,
          profile_photo_url: profilePhoto.trim() || null,
          profile_link: profileLink.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId)
        .then(({ error }) => {
          if (error) setAuthError(error.message);
        });
    }, 650);

    return () => clearTimeout(timeout);
  }, [isLoggedIn, overallPoints, points, profileLink, profileName, profilePhoto, userId]);

  function changeTab(next: TabName) {
    if (next !== "play") {
      setWatchAdsMode(false);
      setBattlePairIds(null);
    }
    setTab(next);
  }

  function swipePrimaryTab(direction: "left" | "right") {
    const currentIndex = primaryTabs.indexOf(tab);
    if (currentIndex === -1) return;
    const nextIndex = direction === "left"
      ? Math.min(primaryTabs.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);
    if (nextIndex !== currentIndex) {
      changeTab(primaryTabs[nextIndex]);
    }
  }

  const swipeResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => {
      if (drawerOpen || createOpen || !primaryTabs.includes(tab)) return false;
      const horizontal = Math.abs(gesture.dx);
      const vertical = Math.abs(gesture.dy);
      return horizontal > 35 && horizontal > vertical * 1.4;
    },
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) < 55) return;
      swipePrimaryTab(gesture.dx < 0 ? "left" : "right");
    }
  });

  async function enterApp(credentials: LoginCredentials) {
    const cleanEmail = credentials.email.trim();
    const cleanName = credentials.name?.trim();
    setAuthError("");
    const result = credentials.isCreate
      ? await supabase.auth.signUp({
          email: cleanEmail,
          password: credentials.password,
          options: {
            data: {
              name: cleanName || cleanEmail.split("@")[0] || "Swap Plays User"
            }
          }
        })
      : await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: credentials.password
        });

    if (result.error) {
      setAuthError(result.error.message);
      return result.error.message;
    }

    const user = result.data.user || result.data.session?.user;
    if (!user) {
      const message = "Check your email to confirm your account, then log in.";
      setAuthError(message);
      return message;
    }

    try {
      await loadOrCreateProfile(user, cleanName);
      await loadCampaigns();
      setIsLoggedIn(true);
      return "";
    } catch (profileError) {
      const message = profileError instanceof Error ? profileError.message : "Could not load your profile.";
      setAuthError(message);
      return message;
    }
  }

  function advanceCampaign() {
    setActiveCampaignIndex((index) => (playableCampaigns.length > 0 ? (index + 1) % playableCampaigns.length : 0));
  }

  function togglePlayCategory(category: MediaCategory) {
    setBattlePairIds(null);
    setSelectedPlayCategories((items) =>
      items.includes(category) ? items.filter((item) => item !== category) : [...items, category]
    );
    setActiveCampaignIndex(0);
    setPlaySequence((value) => value + 1);
  }

  function showCampaignComplete(label: string) {
    setCelebration({ label, key: Date.now() });
    if (Platform.OS === "web") {
      navigator.vibrate?.([60, 40, 80]);
    } else {
      Vibration.vibrate([60, 40, 80]);
    }
  }

  function vibrateLight() {
    if (Platform.OS === "web") {
      navigator.vibrate?.(35);
    } else {
      Vibration.vibrate(35);
    }
  }

  function showPlaqueAward(award: Omit<PlaqueAward, "key">) {
    setPlaqueAward({ ...award, key: Date.now() });
    if (Platform.OS === "web") {
      navigator.vibrate?.([90, 50, 120]);
    } else {
      Vibration.vibrate([90, 50, 120]);
    }
  }

  function openPlaqueForBadge(badgeName: string) {
    const award = plaqueMilestones.find((milestone) => milestone.tier === badgeName);
    if (award) {
      showPlaqueAward(award);
    }
  }

  function addOverallPoints(amount: number) {
    setOverallPoints((previous) => {
      const next = previous + amount;
      const unlocked = plaqueMilestones.find((award) => previous < award.points && next >= award.points);
      if (unlocked) {
        showPlaqueAward(unlocked);
      }
      return next;
    });
  }

  function awardCurrent() {
    if (!activeCampaign) return;
    const earned = earningFor(activeCampaign.secondsTarget);
    const nextPlaysDone = Math.min(activeCampaign.playsTarget, activeCampaign.playsDone + 1);
    setPoints((value) => value + earned);
    addOverallPoints(earned);
    setCampaigns((items) =>
      items.map((item) => (item.id === activeCampaign.id ? { ...item, playsDone: nextPlaysDone } : item))
    );
    persistCampaignPlay(activeCampaign, nextPlaysDone, earned);
    if (nextPlaysDone >= activeCampaign.playsTarget) {
      const label = `${nextPlaysDone}/${activeCampaign.playsTarget} complete`;
      showCampaignComplete(label);
    }
  }

  function awardAdPlay() {
    const earned = earningFor(activeAdCampaign.secondsTarget);
    setPoints((value) => value + earned);
    addOverallPoints(earned);
  }

  function completeCurrentPlay(wasEarned: boolean) {
    if (!wasEarned) {
      Alert.alert("No points earned", "You must let the countdown finish before points are added.");
    }
    setPlaySequence((value) => value + 1);
    advanceCampaign();
  }

  function completeAdPlay(wasEarned: boolean) {
    if (!wasEarned) {
      Alert.alert("No points earned", "You must let the countdown finish before ad points are added.");
    }
    setPlaySequence((value) => value + 1);
    setAdCampaignIndex((index) => (index + 1) % adCampaigns.length);
  }

  function startWatchAds() {
    setBattlePairIds(null);
    setWatchAdsMode(true);
    setTab("play");
    setDrawerOpen(false);
    setPlaySequence((value) => value + 1);
  }

  function completeBattle(winnerId: string) {
    const reward = 40;
    const listenerShare = Math.floor(reward / 2);
    const completedLabels = campaigns
      .filter((campaign) => battlePairIds?.includes(campaign.id))
      .filter((campaign) => campaign.playsDone < campaign.playsTarget && campaign.playsDone + 1 >= campaign.playsTarget)
      .map((campaign) => `${campaign.playsTarget}/${campaign.playsTarget} complete`);

    setPoints((value) => value + listenerShare);
    addOverallPoints(listenerShare);
    setPointsNotice(`+${listenerShare} point split`);
    setCampaigns((items) =>
      items.map((item) => {
        if (!battlePairIds?.includes(item.id)) return item;
        const nextPlaysDone = Math.min(item.playsTarget, item.playsDone + 1);
        persistCampaignPlay(item, nextPlaysDone, listenerShare);
        return { ...item, playsDone: nextPlaysDone };
      })
    );
    setBattlePairIds(null);
    setPlaySequence((value) => value + 1);
    advanceCampaign();
    if (completedLabels.length > 0) {
      showCampaignComplete(completedLabels[0]);
    }
  }

  function skipBattle() {
    setBattlePairIds(null);
    setPlaySequence((value) => value + 1);
    advanceCampaign();
  }

  function handleAutoplayToggle(nextValue: boolean) {
    vibrateLight();
    if (nextValue) {
      if (hasAutoplayAccess) {
        setAutoplay(true);
        return;
      }
      setAutoplayModal(true);
      return;
    }
    setAutoplay(false);
  }

  const paypalCaptureStarted = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web" || !isLoggedIn || paypalCaptureStarted.current) return;
    const params = new URLSearchParams(window.location.search);
    const paypalStatus = params.get("paypal");
    const orderId = params.get("token");
    if (paypalStatus === "cancel") {
      setPaypalNotice("PayPal checkout was cancelled.");
      Alert.alert("PayPal cancelled", "Autoplay was not activated.");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    if (paypalStatus !== "success" || !orderId) return;

    paypalCaptureStarted.current = true;
    setPaypalNotice("Confirming PayPal payment...");
    capturePayPalOrder(orderId)
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Could not confirm PayPal payment.";
        setPaypalNotice(message);
      })
      .finally(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      });
  }, [isLoggedIn]);

  useEffect(() => {
    if (!celebration) return;
    const timeout = setTimeout(() => setCelebration(null), 2800);
    return () => clearTimeout(timeout);
  }, [celebration]);

  useEffect(() => {
    if (!pointsNotice) return;
    const timeout = setTimeout(() => setPointsNotice(""), 4200);
    return () => clearTimeout(timeout);
  }, [pointsNotice]);

  useEffect(() => {
    if (autoplay && battlePairIds) {
      setBattlePairIds(null);
      return;
    }
    if (battlePairIds && battleCampaigns.length < 2) {
      setBattlePairIds(null);
      return;
    }
    if (watchAdsMode || autoplay || tab !== "play" || battlePairIds || playableCampaigns.length < 2) return;
    if (Math.random() > 0.32) return;
    const battlePools = mediaCategories
      .map((category) => playableCampaigns.filter((campaign) => campaign.category === category))
      .filter((pool) => pool.length >= 2);
    if (battlePools.length === 0) return;
    const pool = battlePools[Math.floor(Math.random() * battlePools.length)];
    const start = Math.floor(Math.random() * pool.length);
    const challenger = pool[start];
    const opponent = pool[(start + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length];
    setBattlePairIds([challenger.id, opponent.id]);
  }, [autoplay, battleCampaigns.length, battlePairIds, playableCampaigns, playSequence, tab, watchAdsMode]);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.loadingScreen}>
          <Text style={styles.loadingText}>Loading Swap Plays...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <LoginScreen
          onEnter={enterApp}
          authError={authError}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.app}>
        <Header
          title={headerTitle}
          points={points}
          badge={badge}
          pointsNotice={pointsNotice}
          onBadgePress={() => openPlaqueForBadge(badge)}
          onMenu={() => setDrawerOpen(true)}
          showBack={createOpen}
          onBack={() => setCreateOpen(false)}
        />
        {createOpen ? (
          <CreateCampaign
            points={hasUnlimitedCampaignPoints ? Number.MAX_SAFE_INTEGER : points}
            hasUnlimitedPoints={hasUnlimitedCampaignPoints}
            onCancel={() => setCreateOpen(false)}
            onCreate={createCampaign}
          />
        ) : (
          <>
            <View style={styles.screenStack} {...swipeResponder.panHandlers}>
              <View style={[styles.screenPane, tab === "campaigns" ? styles.activePane : styles.hiddenPane]} pointerEvents={tab === "campaigns" ? "auto" : "none"}>
                <CampaignScreen campaigns={campaigns} onCreate={() => setCreateOpen(true)} onDelete={deleteCampaign} />
              </View>
              <View style={[styles.screenPane, tab === "play" ? styles.activePane : styles.hiddenPane]} pointerEvents={tab === "play" ? "auto" : "none"}>
                <PlayScreen
                  campaign={playCampaign}
                  isAdMode={watchAdsMode}
                  battleCampaigns={!watchAdsMode && battleCampaigns.length === 2 ? [battleCampaigns[0], battleCampaigns[1]] : undefined}
                  autoplay={autoplay}
                  onToggleAutoplay={handleAutoplayToggle}
                  onAward={watchAdsMode ? awardAdPlay : awardCurrent}
                  onComplete={watchAdsMode ? completeAdPlay : completeCurrentPlay}
                  onBattleComplete={completeBattle}
                  onBattleSkip={skipBattle}
                  resetKey={playSequence}
                  onBuyAutoplay={() => setAutoplayModal(true)}
                  selectedCategories={selectedPlayCategories}
                  onToggleCategory={togglePlayCategory}
                />
              </View>
              <View style={[styles.screenPane, tab === "leaderboard" ? styles.activePane : styles.hiddenPane]} pointerEvents={tab === "leaderboard" ? "auto" : "none"}>
                <LeaderboardScreen campaigns={campaigns} profileName={profileName.trim() || "Swap Plays User"} profilePhoto={profilePhoto} profileLink={profileLink} overallPoints={overallPoints} />
              </View>
              {tab === "redeem" && <RedeemScreen points={points} badge={badge} onRedeem={(amount) => setPoints((value) => value + amount)} />}
              {tab === "invite" && <InviteScreen />}
              {tab === "awards" && <AwardsScreen overallPoints={overallPoints} onAwardPress={openPlaqueForBadge} />}
              {tab === "how" && <HowScreen onPlaquePress={openPlaqueForBadge} />}
            </View>
            <BottomTabs active={tab} onChange={changeTab} />
          </>
        )}
        <ProfileDrawer
          open={drawerOpen}
          points={points}
          overallPoints={overallPoints}
          badge={badge}
          autoplay={autoplay}
          profileName={profileName}
          profileEmail={profileEmail}
          profilePhoto={profilePhoto}
          profileLink={profileLink}
          onProfileNameChange={setProfileName}
          onProfilePhotoChange={setProfilePhoto}
          onProfileLinkChange={setProfileLink}
          onBadgePress={() => openPlaqueForBadge(badge)}
          onClose={() => setDrawerOpen(false)}
          onNavigate={(next) => {
            changeTab(next);
            setDrawerOpen(false);
          }}
          onWatchAds={startWatchAds}
          onAutoplay={() => {
            setDrawerOpen(false);
            setAutoplayModal(true);
          }}
          onLogout={async () => {
            setDrawerOpen(false);
            await supabase.auth.signOut();
            setIsLoggedIn(false);
            setUserId("");
          }}
        />
        <AutoplayModal
          visible={autoplayModal}
          onClose={() => setAutoplayModal(false)}
          notice={paypalNotice}
          onBuy={startPayPalCheckout}
        />
        {celebration && <ConfettiCelebration key={celebration.key} label={celebration.label} />}
        {plaqueAward && <PlaqueAchievementModal award={plaqueAward} onClose={() => setPlaqueAward(null)} />}
      </View>
    </SafeAreaView>
  );
}

function Header({
  title,
  points,
  badge,
  pointsNotice,
  onBadgePress,
  onMenu,
  showBack,
  onBack
}: {
  title: string;
  points: number;
  badge: string;
  pointsNotice: string;
  onBadgePress: () => void;
  onMenu: () => void;
  showBack: boolean;
  onBack: () => void;
}) {
  const canOpenPlaque = badge === "gold" || badge === "platinum" || badge === "diamond";
  return (
    <View style={styles.header}>
      <Pressable style={styles.iconButton} onPress={showBack ? onBack : onMenu}>
        <Ionicons name={showBack ? "arrow-back" : "menu"} size={34} color="#fff" />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <Pressable disabled={!canOpenPlaque} onPress={onBadgePress} style={[styles.pointsPill, canOpenPlaque && styles.pointsPillPressable]}>
        <View style={styles.headerBadgeButton}>
          <BadgeIcon badge={badge} />
        </View>
        <Text style={styles.pointsText}>{points}</Text>
        {pointsNotice ? <Text style={styles.pointsNotice}>{pointsNotice}</Text> : null}
      </Pressable>
    </View>
  );
}

function BadgeIcon({ badge }: { badge: string }) {
  if (badge === "platinum") {
    return <Image source={require("./assets/badge-silver.jpeg")} style={styles.badgeCircleImage} />;
  }
  if (badge === "gold") {
    return <Image source={require("./assets/badge-gold.jpeg")} style={styles.badgeCircleImage} />;
  }
  if (badge === "diamond") {
    return <Image source={require("./assets/badge-diamond.png")} style={styles.badgeDiamondImage} />;
  }
  return (
    <View style={styles.recordBadgeIcon}>
      <View style={styles.recordBadgeSheen} />
      <View style={styles.recordBadgeCenter}>
        <View style={styles.recordBadgeDot} />
      </View>
    </View>
  );
}

function LoginScreen({ onEnter, authError }: { onEnter: (credentials: LoginCredentials) => Promise<string | void>; authError: string }) {
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<"login" | "create">("login");
  const [name, setName] = useState("Swap Plays User");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isCreate = mode === "create";
  const loginArtRatio = 1083 / 1452;
  const loginArtWidth = Math.min(width - 20, (height - 52) * loginArtRatio, 560);
  const loginArtHeight = loginArtWidth / loginArtRatio;
  const visibleError = error || authError;

  async function submit() {
    const cleanEmail = email.trim();
    const cleanName = name.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Enter a valid email to continue.");
      return;
    }
    if (!password.trim()) {
      setError("Enter your password to continue.");
      return;
    }
    setError("");
    setSubmitting(true);
    const result = await onEnter({
      email: cleanEmail,
      password,
      name: isCreate ? cleanName || cleanEmail.split("@")[0] || "Swap Plays User" : undefined,
      isCreate
    });
    if (result) setError(result);
    setSubmitting(false);
  }

  async function googleSignIn() {
    setError("");
    if (Platform.OS !== "web") {
      setError("Google sign-in is ready for the web version. Mobile deep links can be added next.");
      return;
    }
    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });
    if (googleError) setError(googleError.message);
  }

  return (
    <View style={styles.loginScreen}>
      <ScrollView contentContainerStyle={styles.loginScroll} keyboardShouldPersistTaps="handled">
        <ImageBackground
          source={require("./assets/login-screen-art.png")}
          resizeMode="cover"
          style={[styles.loginArtwork, { width: loginArtWidth, height: loginArtHeight }]}
          imageStyle={styles.loginArtworkImage}
        >
          <View style={styles.loginRealCard}>
            <View style={styles.loginRealModeRow}>
              <Pressable
                testID="login-tab-login"
                accessibilityRole="button"
                style={[styles.loginRealModeButton, !isCreate ? styles.loginRealModeDark : styles.loginRealModeLight]}
                onPress={() => {
                  setMode("login");
                  setError("");
                }}
              >
                <Text style={[styles.loginRealModeText, !isCreate ? styles.loginRealModeTextDark : styles.loginRealModeTextLight]}>Log In</Text>
              </Pressable>
              <Pressable
                testID="login-tab-create"
                accessibilityRole="button"
                style={[styles.loginRealModeButton, isCreate ? styles.loginRealModeDark : styles.loginRealModeLight]}
                onPress={() => {
                  setMode("create");
                  setError("");
                }}
              >
                <Text style={[styles.loginRealModeText, isCreate ? styles.loginRealModeTextDark : styles.loginRealModeTextLight]}>Create Account</Text>
              </Pressable>
            </View>
            <View style={styles.loginRealInputRow}>
              <Ionicons name="mail" size={21} color="#050608" />
              <TextInput
                testID="login-email-input"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="creator@example.com"
                placeholderTextColor="#111318"
                style={styles.loginRealInput}
              />
            </View>
            <View style={styles.loginRealInputRow}>
              <Ionicons name="lock-closed" size={21} color="#050608" />
              <TextInput
                testID="login-password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#777"
                secureTextEntry
                style={styles.loginRealInput}
              />
            </View>
            {visibleError ? (
              <View style={styles.loginRealError}>
                <Ionicons name="alert-circle" size={15} color="#d93025" />
                <Text style={styles.loginErrorText}>{visibleError}</Text>
              </View>
            ) : null}
            <Pressable testID="login-submit" accessibilityRole="button" disabled={submitting} style={[styles.loginRealSubmitButton, submitting && styles.loginButtonDisabled]} onPress={submit}>
              <Text style={styles.loginArtworkSubmitText}>{submitting ? "Please wait..." : isCreate ? "Create Account  ->" : "Log In  ->"}</Text>
            </Pressable>
            <Pressable testID="login-google" accessibilityRole="button" style={styles.loginGoogleButton} onPress={googleSignIn}>
              <View style={styles.loginGoogleIcon}>
                <Text style={styles.loginGoogleIconText}>G</Text>
              </View>
              <Text style={styles.loginGoogleText}>Sign in with Google</Text>
            </Pressable>
            <View style={styles.loginRealFooter}>
              <Pressable
                testID="login-forgot-password"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => Alert.alert("Password reset", "Password reset will be connected when account services are added.")}
              >
                <Text style={styles.loginRealFooterText}>Forgot password?</Text>
              </Pressable>
            </View>
          </View>
        </ImageBackground>
      </ScrollView>
    </View>
  );
}

function ConfettiCelebration({ label }: { label: string }) {
  const drops = useRef(
    Array.from({ length: 30 }, (_, index) => ({
      id: index,
      left: `${(index * 37) % 100}%` as `${number}%`,
      delay: (index % 10) * 90,
      duration: 1150 + (index % 7) * 145,
      size: 8 + (index % 4) * 4,
      color: ["#ffd84d", "#39cc70", "#1d8af0", "#e44e9b", "#ffffff"][index % 5],
      fall: new Animated.Value(0)
    }))
  ).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    drops.forEach((drop) => {
      drop.fall.setValue(0);
      Animated.timing(drop.fall, {
        toValue: 1,
        duration: drop.duration,
        delay: drop.delay,
        useNativeDriver: true
      }).start();
    });
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 70, useNativeDriver: true })
    ]).start();
  }, [drops, shake]);

  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] });

  return (
    <View pointerEvents="none" style={styles.celebrationOverlay}>
      {drops.map((drop) => {
        const translateY = drop.fall.interpolate({ inputRange: [0, 1], outputRange: [-80, 760] });
        const rotate = drop.fall.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${180 + drop.id * 21}deg`] });
        const opacity = drop.fall.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={drop.id}
            style={[
              styles.confettiPiece,
              {
                left: drop.left,
                width: drop.size,
                height: drop.size * 1.7,
                backgroundColor: drop.color,
                opacity,
                transform: [{ translateY }, { rotate }]
              }
            ]}
          />
        );
      })}
      <Animated.View style={[styles.celebrationCard, { transform: [{ translateX: shakeX }] }]}>
        <Text style={styles.celebrationTitle}>{label}</Text>
        <Text style={styles.celebrationCopy}>Campaign complete</Text>
      </Animated.View>
    </View>
  );
}

function PlaqueAchievementModal({ award, onClose }: { award: PlaqueAward; onClose: () => void }) {
  const accent = award.tier === "gold" ? "#f4c430" : award.tier === "platinum" ? "#d9e6f2" : "#9fe9ff";
  const accentSoft = award.tier === "gold" ? "rgba(244,196,48,0.22)" : award.tier === "platinum" ? "rgba(217,230,242,0.2)" : "rgba(159,233,255,0.22)";
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.plaqueBackdrop}>
        <View style={[styles.plaqueCard, { borderColor: accentSoft }]}>
          <Pressable style={styles.plaqueClose} onPress={onClose}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
          <View style={[styles.plaqueGlow, { backgroundColor: accentSoft }]} />
          <View style={styles.plaqueHeaderRow}>
            <View style={[styles.plaqueDot, { backgroundColor: accent }]} />
            <Text style={styles.plaqueEyebrow}>Overall points milestone</Text>
          </View>
          <View style={styles.plaqueImageStage}>
            <Image source={award.image} style={styles.plaqueImage} />
          </View>
          <Text style={styles.plaqueTitle}>{award.label}</Text>
          <Text style={styles.plaqueCopy}>Unlocks at {award.points.toLocaleString()} overall points. Once earned, this badge stays on your profile.</Text>
          <Pressable style={styles.plaqueButton} onPress={onClose}>
            <Text style={styles.plaqueButtonText}>Keep Playing</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CampaignScreen({ campaigns, onCreate, onDelete }: { campaigns: Campaign[]; onCreate: () => void; onDelete: (id: string) => void }) {
  const totalRemaining = campaigns.reduce((sum, campaign) => sum + Math.max(0, campaign.playsTarget - campaign.playsDone), 0);
  const activeCount = campaigns.filter((campaign) => campaign.playsDone < campaign.playsTarget).length;
  const activeLabel = activeCount === 1 ? "1 live upload" : `${activeCount} live uploads`;
  return (
    <View style={styles.content}>
      {campaigns.length === 0 ? (
        <View style={styles.empty}>
          <Image source={require("./assets/swap-plays-logo-transparent.png")} style={styles.emptyLogo} />
          <Text style={styles.emptyTitle}>No Campaign</Text>
          <Text style={styles.emptyCopy}>Your campaigns appear here after you upload a media and set your play order.</Text>
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.campaignSummary}>
              <View>
                <Text style={styles.summaryEyebrow}>Active queue</Text>
                <Text style={styles.summaryTitle}>{activeLabel}</Text>
              </View>
              <View style={styles.summaryMetric}>
                <Text style={styles.summaryMetricValue}>{totalRemaining}</Text>
                <Text style={styles.summaryMetricLabel}>plays left</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => <CampaignRow campaign={item} onDelete={() => onDelete(item.id)} />}
        />
      )}
      <Pressable style={styles.fab} onPress={onCreate}>
        <Ionicons name="add" size={34} color="#fff" />
      </Pressable>
    </View>
  );
}

function CampaignRow({ campaign, onDelete }: { campaign: Campaign; onDelete: () => void }) {
  const meta = platformMeta[campaign.platform];
  const progress = campaign.playsDone / campaign.playsTarget;
  const isComplete = campaign.playsDone >= campaign.playsTarget;
  return (
    <View style={styles.campaignRow}>
      <View style={[styles.thumb, { backgroundColor: campaign.mediaKind === "audio" ? "#fff" : meta.color }]}>
        {campaign.thumbnailUrl ? (
          <Image source={{ uri: campaign.thumbnailUrl }} style={styles.thumbImage} />
        ) : campaign.mediaKind === "audio" ? (
          <Image source={require("./assets/swap-plays-symbol-white.png")} style={styles.thumbLogo} />
        ) : (
          <Ionicons name="play" size={30} color="#fff" />
        )}
      </View>
      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={styles.rowTitle}>#{campaign.title}</Text>
        <View style={styles.rowMetaLine}>
          <Text style={styles.categoryBadge}>{campaign.category}</Text>
          <Text style={styles.rowSub}>{campaign.createdAt}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, isComplete && styles.progressFillComplete, { width: `${Math.min(100, progress * 100)}%` }]} />
        </View>
        <Text style={[styles.rowSub, isComplete && styles.rowCompleteText]}>{campaign.playsDone}/{campaign.playsTarget} {isComplete ? "complete" : "plays"}</Text>
      </View>
      <Pressable style={styles.deleteButton} onPress={onDelete}>
        <Ionicons name="trash-outline" size={20} color="#ff3b30" />
      </Pressable>
    </View>
  );
}

function CreateCampaign({ points, hasUnlimitedPoints = false, onCancel, onCreate }: { points: number; hasUnlimitedPoints?: boolean; onCancel: () => void; onCreate: (campaign: CampaignDraft) => Promise<string | void> }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<MediaCategory>("Music");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedMediaKind, setUploadedMediaKind] = useState<MediaKind>("audio");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [playsIndex, setPlaysIndex] = useState(0);
  const [secondsIndex, setSecondsIndex] = useState(0);
  const plays = playOptions[playsIndex];
  const seconds = secondOptions[secondsIndex];
  const cost = pointCost(plays, seconds);
  const fileReady = Boolean(uploadedFile || /^blob:/i.test(url));
  const hasEnoughPoints = points >= cost;

  function updateExternalLink(value: string) {
    setExternalLink(value);
    const trimmedValue = value.trim();
    setLinkError(trimmedValue && !isLikelyUrl(trimmedValue) ? "Enter a valid link that starts with http:// or https://." : "");
  }

  function chooseMusicFile() {
    if (Platform.OS !== "web") {
      Alert.alert("Upload music", "File upload can be connected in the iOS and Android build.");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,video/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const mediaUrl = URL.createObjectURL(file);
      const nextKind = file.type.startsWith("video/") ? "video" : "audio";
      setUploadedFile(file);
      setUploadedFileName(file.name);
      setUploadedMediaKind(nextKind);
      setUrl(mediaUrl);
      setSubmitError("");
      setThumbnailUrl("");
      if (nextKind === "video") {
        const preview = await createVideoThumbnail(mediaUrl);
        if (preview) setThumbnailUrl(preview);
      }
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    };
    input.click();
  }

  async function submit() {
    if (!fileReady) {
      Alert.alert("Upload music", "Choose an audio file before creating this campaign.");
      return;
    }
    if (!hasPermission) {
      setPermissionError("Please check this box to confirm you own this media or have permission to promote it.");
      return;
    }
    setPermissionError("");
    const trimmedExternalLink = externalLink.trim();
    if (trimmedExternalLink && !isLikelyUrl(trimmedExternalLink)) {
      setLinkError("Enter a valid link that starts with http:// or https://.");
      return;
    }
    setLinkError("");
    if (!hasEnoughPoints) {
      Alert.alert("Not enough points", `This campaign costs ${cost} points. Earn more points before creating it.`);
      return;
    }
    const name = title.trim() || `Swap ${new Date().toLocaleString()}`;
    setSubmitError("");
    setSubmitting(true);
    const message = await onCreate({
      title: name,
      category,
      url,
      mediaKind: uploadedMediaKind,
      thumbnailUrl: thumbnailUrl || undefined,
      externalLink: trimmedExternalLink || undefined,
      playsTarget: plays,
      secondsTarget: seconds,
      pointsCost: cost,
      mediaFile: uploadedFile || undefined
    });
    setSubmitting(false);
    if (message) {
      setSubmitError(message);
      return;
    }
    Alert.alert("Campaign created", `${name} was added to your campaign list.`);
  }

  return (
    <ScrollView style={styles.create} contentContainerStyle={styles.createInner}>
      <View style={styles.audioOnlyHeader}>
        <Ionicons name="cloud-upload-outline" size={32} color="#050505" />
        <Text style={styles.audioOnlyTitle}>Upload Media</Text>
      </View>
      <Pressable style={styles.uploadBox} onPress={chooseMusicFile}>
        <View style={styles.uploadIcon}>
          <Ionicons name="musical-notes" size={24} color="#1d8af0" />
        </View>
        <View style={styles.uploadCopy}>
          <Text style={styles.uploadTitle}>Upload your media</Text>
          <Text numberOfLines={1} style={styles.uploadSub}>{uploadedFileName || "Choose an audio or video file from your device"}</Text>
        </View>
        <Ionicons name="cloud-upload-outline" size={25} color="#111318" />
      </Pressable>
      <View style={[styles.linkStatus, fileReady ? styles.linkStatusGood : styles.linkStatusEmpty]}>
        <Ionicons name={fileReady ? "checkmark-circle" : "information-circle-outline"} size={20} color={fileReady ? "#148c45" : "#777"} />
        <Text style={[styles.linkStatusText, fileReady && styles.linkStatusGoodText]}>
          {fileReady ? `${uploadedMediaKind === "video" ? "Video" : "Music"} file selected. Press Done to create this campaign.` : "Upload an audio or video file to continue."}
        </Text>
      </View>
      <Text style={styles.sectionTitle}>Category</Text>
      <View style={styles.categoryGrid}>
        {mediaCategories.map((item) => {
          const isSelected = category === item;
          return (
            <Pressable
              key={item}
              style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
              onPress={() => setCategory(item)}
            >
              <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        style={[styles.permissionRow, permissionError && styles.permissionRowError]}
        onPress={() => {
          setHasPermission((value) => {
            const nextValue = !value;
            if (nextValue) setPermissionError("");
            return nextValue;
          });
        }}
      >
        <View style={[styles.permissionBox, hasPermission && styles.permissionBoxChecked]}>
          {hasPermission && <Ionicons name="checkmark" size={18} color="#fff" />}
        </View>
        <Text style={styles.permissionText}>I own this media or have permission to promote it.</Text>
      </Pressable>
      {permissionError ? (
        <View style={styles.permissionErrorRow}>
          <Ionicons name="alert-circle" size={18} color="#d93025" />
          <Text style={styles.permissionErrorText}>{permissionError}</Text>
        </View>
      ) : null}
      <TextInput
        value={externalLink}
        onChangeText={updateExternalLink}
        placeholder="Optional link for listeners to visit"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={[styles.orderInput, linkError && styles.orderInputError]}
      />
      {linkError ? (
        <View style={styles.permissionErrorRow}>
          <Ionicons name="alert-circle" size={18} color="#d93025" />
          <Text style={styles.permissionErrorText}>{linkError}</Text>
        </View>
      ) : null}
      <Text style={styles.helpText}>Only the uploaded file plays in the app. The optional link appears on the Play page for users to open separately.</Text>
      <Text style={styles.sectionTitle}>Order Setting</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="Campaign name" style={styles.orderInput} />
      <Stepper label="Number of plays" value={plays} onMinus={() => setPlaysIndex((index) => Math.max(0, index - 1))} onPlus={() => setPlaysIndex((index) => Math.min(playOptions.length - 1, index + 1))} />
      <Stepper label="Time (seconds)" value={seconds} onMinus={() => setSecondsIndex((index) => Math.max(0, index - 1))} onPlus={() => setSecondsIndex((index) => Math.min(secondOptions.length - 1, index + 1))} />
      <View style={styles.totalRow}>
        <MaterialCommunityIcons name="calculator" size={24} color="#1d8af0" />
        <Text style={styles.totalLabel}>{hasUnlimitedPoints ? "Total Points Covered" : "Total Points"}</Text>
        <Text style={styles.totalValue}>{hasUnlimitedPoints ? "Unlimited" : cost}</Text>
      </View>
      {!hasEnoughPoints ? (
        <View style={styles.notEnoughPoints}>
          <Ionicons name="alert-circle" size={20} color="#d93025" />
          <Text style={styles.notEnoughPointsText}>You do not have enough points. This campaign costs {cost.toLocaleString()} points, but you only have {points.toLocaleString()}.</Text>
        </View>
      ) : null}
      {submitError ? (
        <View style={styles.permissionErrorRow}>
          <Ionicons name="alert-circle" size={18} color="#d93025" />
          <Text style={styles.permissionErrorText}>{submitError}</Text>
        </View>
      ) : null}
      <Pressable style={[styles.doneButton, submitting && styles.loginButtonDisabled]} disabled={submitting} onPress={submit}>
        <Text style={styles.doneButtonText}>{submitting ? "Uploading..." : "Done"}</Text>
      </Pressable>
      <Pressable style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
      <Text style={styles.warning}>Warning: Upload only music you own or have permission to promote.</Text>
    </ScrollView>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: number; onMinus: () => void; onPlus: () => void }) {
  const holdDelay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopHold() {
    if (holdDelay.current) {
      clearTimeout(holdDelay.current);
      holdDelay.current = null;
    }
    if (holdInterval.current) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
  }

  function startHold(action: () => void) {
    stopHold();
    action();
    holdDelay.current = setTimeout(() => {
      holdInterval.current = setInterval(action, 80);
    }, 360);
  }

  useEffect(() => stopHold, []);

  return (
    <View style={styles.stepper}>
      <Pressable
        onPressIn={() => startHold(onMinus)}
        onPressOut={stopHold}
        onResponderTerminate={stopHold}
        onPress={undefined}
        style={styles.stepButton}
      >
        <Ionicons name="remove" size={18} color="#1d8af0" />
      </Pressable>
      <Text style={styles.stepLabel}>{label}</Text>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        onPressIn={() => startHold(onPlus)}
        onPressOut={stopHold}
        onResponderTerminate={stopHold}
        onPress={undefined}
        style={styles.stepButton}
      >
        <Ionicons name="add" size={18} color="#1d8af0" />
      </Pressable>
    </View>
  );
}

function PlayScreen({
  campaign,
  isAdMode = false,
  battleCampaigns,
  autoplay,
  onToggleAutoplay,
  onAward,
  onComplete,
  onBattleComplete,
  onBattleSkip,
  resetKey,
  onBuyAutoplay,
  selectedCategories,
  onToggleCategory
}: {
  campaign?: Campaign;
  isAdMode?: boolean;
  battleCampaigns?: [Campaign, Campaign];
  autoplay: boolean;
  onToggleAutoplay: (value: boolean) => void;
  onAward: () => void;
  onComplete: (wasEarned: boolean) => void;
  onBattleComplete: (winnerId: string) => void;
  onBattleSkip: () => void;
  resetKey: number;
  onBuyAutoplay: () => void;
  selectedCategories: MediaCategory[];
  onToggleCategory: (category: MediaCategory) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(campaign?.secondsTarget ?? 0);
  const [pointsEarned, setPointsEarned] = useState(false);
  const playNextOnLoad = useRef(false);

  useEffect(() => {
    setIsPlaying(playNextOnLoad.current);
    playNextOnLoad.current = false;
    setPointsEarned(false);
    setSecondsRemaining(campaign?.secondsTarget ?? 0);
  }, [campaign?.id, campaign?.secondsTarget, resetKey]);

  useEffect(() => {
    if (!isPlaying || pointsEarned || secondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setSecondsRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlaying, pointsEarned, secondsRemaining]);

  useEffect(() => {
    if (!campaign || !isPlaying || pointsEarned || secondsRemaining !== 0) return;
    setPointsEarned(true);
    onAward();
    if (autoplay) {
      setIsPlaying(false);
      playNextOnLoad.current = true;
      onComplete(true);
    }
  }, [autoplay, campaign, isPlaying, onAward, onComplete, pointsEarned, secondsRemaining]);

  const categoryFilter = (
    <View style={styles.playCategoryPanel}>
      <Text style={styles.playCategoryTitle}>Watch categories</Text>
      <View style={styles.playCategoryGrid}>
        {mediaCategories.map((item) => {
          const isSelected = selectedCategories.includes(item);
          return (
            <Pressable
              key={item}
              style={[styles.playCategoryChip, isSelected && styles.playCategoryChipActive]}
              onPress={() => onToggleCategory(item)}
            >
              <Text style={[styles.playCategoryChipText, isSelected && styles.playCategoryChipTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  if (battleCampaigns) {
    return (
      <BattlePlayScreen
        campaigns={battleCampaigns}
        resetKey={resetKey}
        onBattleComplete={onBattleComplete}
        onBattleSkip={onBattleSkip}
        categoryFilter={categoryFilter}
      />
    );
  }

  if (!campaign) {
    const message = selectedCategories.length === 0
      ? "Pick at least one category to start watching media."
      : "No active campaigns match your selected categories yet.";
    return (
      <View style={styles.playFixedScreen}>
        {!isAdMode ? categoryFilter : null}
        <View style={styles.empty}><Text style={styles.emptyCopy}>{message}</Text></View>
      </View>
    );
  }
  const current = campaign;
  const meta = platformMeta[current.platform];
  const source = getMediaSource(current.url, current.mediaKind);
  function openCampaignLink() {
    if (!current.externalLink) {
      Alert.alert("No link", "This campaign does not have a link attached.");
      return;
    }
    if (Platform.OS === "web") {
      window.open(current.externalLink, "_blank", "noopener,noreferrer");
      return;
    }
    Linking.openURL(current.externalLink);
  }
  function shareCampaign() {
    const message = current.externalLink ? `${current.title}\n${current.externalLink}` : current.title;
    Share.share({ message });
  }

  return (
    <View style={styles.playFixedScreen}>
      {!isAdMode ? categoryFilter : null}
      <View style={isAdMode ? styles.adTvSet : undefined}>
        {isAdMode ? (
          <View style={styles.adAntennaRow}>
            <View style={styles.adAntenna} />
            <View style={[styles.adAntenna, styles.adAntennaRight]} />
          </View>
        ) : null}
        <View style={[styles.player, { backgroundColor: meta.color }, isAdMode && styles.adTvScreen]}>
          {isAdMode ? <View pointerEvents="none" style={styles.adScreenGlow} /> : null}
          <View style={styles.playerTop}>
            <View />
            <Pressable style={styles.shareButton} onPress={shareCampaign}>
              <Ionicons name="share-social" size={26} color="#fff" />
            </Pressable>
          </View>
          <Text numberOfLines={2} style={[styles.mediaTitle, isAdMode && styles.adMediaTitle]}>{current.title}</Text>
          {!isAdMode ? <Text style={styles.playerCategoryBadge}>{current.category}</Text> : null}
          {isPlaying ? (
            <EmbeddedMedia key={`${current.id}-${resetKey}`} source={source} />
          ) : source.kind === "restricted" ? (
            <View style={styles.embeddedFallback}>
              <Ionicons name="alert-circle" size={42} color="#fff" />
              <Text style={styles.embeddedFallbackText}>Instagram links cannot play inside this app.</Text>
            </View>
          ) : (
            <Pressable
              style={[styles.playCircle, isAdMode && styles.adPlayCircle]}
              onPress={() => {
                setIsPlaying(true);
              }}
            >
              <Ionicons name="play" size={52} color="#111" />
            </Pressable>
          )}
          <View style={isAdMode ? styles.adWatchCue : undefined}>
            {isAdMode ? <Ionicons name="eye" size={16} color="#79bfff" /> : null}
            <Text style={[styles.listenText, isAdMode && styles.adListenText]}>{source.kind === "restricted" ? "Use a playable media link" : isPlaying ? "Playing in app" : "Press play to start"}</Text>
          </View>
        </View>
        {isAdMode ? (
          <>
            <View style={styles.adTvNeck} />
            <View style={styles.adTvBase} />
          </>
        ) : null}
      </View>
      <View style={styles.playControlsRow}>
        <Pressable style={[styles.playActionTab, !current.externalLink && styles.playActionTabDisabled]} onPress={openCampaignLink}>
          <Ionicons name="link" size={18} color={current.externalLink ? "#1d8af0" : "#aeb5c0"} />
          <Text style={[styles.playActionTabText, !current.externalLink && styles.playActionTabDisabledText]}>Link</Text>
        </Pressable>
        <View style={styles.autoplayRow}>
          <Switch value={autoplay} onValueChange={onToggleAutoplay} />
          <Text style={styles.autoplayText}>Autoplay</Text>
          <Pressable onPress={onBuyAutoplay}><Text style={styles.buyText}>Upgrade</Text></Pressable>
        </View>
      </View>
      <View style={styles.earnRow}>
        <View style={styles.metric}><Text style={styles.metricValue}>{secondsRemaining}</Text><Text style={styles.metricLabel}>Seconds</Text></View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}><Text style={[styles.metricValue, { color: "#39cc70" }]}>{earningFor(current.secondsTarget)}</Text><Text style={styles.metricLabel}>{pointsEarned ? "Earned" : "Points"}</Text></View>
      </View>
      <Pressable
        style={styles.skipButton}
        onPress={() => {
          playNextOnLoad.current = true;
          onComplete(pointsEarned);
        }}
      >
        <Text style={styles.skipText}>Complete Play</Text>
      </Pressable>
    </View>
  );
}

function BattlePlayScreen({
  campaigns,
  resetKey,
  onBattleComplete,
  onBattleSkip,
  categoryFilter
}: {
  campaigns: [Campaign, Campaign];
  resetKey: number;
  onBattleComplete: (winnerId: string) => void;
  onBattleSkip: () => void;
  categoryFilter?: React.ReactNode;
}) {
  const [phase, setPhase] = useState<"ready" | "left" | "right" | "vote">("ready");
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [secondsRight, setSecondsRight] = useState(15);
  const [selectedWinner, setSelectedWinner] = useState("");
  const [left, right] = campaigns;
  const activeCampaign = phase === "left" ? left : phase === "right" ? right : undefined;
  const activeSeconds = phase === "left" ? secondsLeft : phase === "right" ? secondsRight : 0;

  useEffect(() => {
    setPhase("ready");
    setSecondsLeft(15);
    setSecondsRight(15);
    setSelectedWinner("");
  }, [left.id, resetKey, right.id]);

  useEffect(() => {
    if (phase !== "left" && phase !== "right") return;
    const timer = setInterval(() => {
      if (phase === "left") {
        setSecondsLeft((value) => Math.max(0, value - 1));
      } else {
        setSecondsRight((value) => Math.max(0, value - 1));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === "left" && secondsLeft === 0) {
      setPhase("right");
      return;
    }
    if (phase === "right" && secondsRight === 0) {
      setPhase("vote");
    }
  }, [phase, secondsLeft, secondsRight]);

  function chooseWinner(winnerId: string) {
    setSelectedWinner(winnerId);
    onBattleComplete(winnerId);
  }

  function startBattleTimer() {
    setPhase("left");
  }

  return (
    <View style={styles.playFixedScreen}>
      {categoryFilter}
      <View style={styles.battleSplit}>
        <BattlePane campaign={left} side="A" active={phase === "left"} listened={secondsLeft === 0 || phase === "right" || phase === "vote"} resetKey={resetKey} />
        <BattlePane campaign={right} side="B" active={phase === "right"} listened={secondsRight === 0 || phase === "vote"} resetKey={resetKey} />
      </View>
      <View style={styles.battleStatus}>
        {phase === "ready" ? (
          <>
            <Text style={styles.battleStatusText}>Ready for battle</Text>
            <Text style={styles.battleTimerLabel}>Each media gets 15 seconds</Text>
            <Pressable style={styles.battleStartButton} onPress={startBattleTimer}>
              <Ionicons name="timer" size={18} color="#fff" />
              <Text style={styles.battleStartText}>Start Battle Timer</Text>
            </Pressable>
          </>
        ) : phase === "vote" ? (
          <>
            <Text style={styles.battleStatusText}>Choose the winner</Text>
            <View style={styles.battleVoteRow}>
              {campaigns.map((campaign, index) => (
                <Pressable
                  key={campaign.id}
                  disabled={Boolean(selectedWinner)}
                  style={[styles.battleVoteButton, selectedWinner === campaign.id && styles.battleVoteButtonActive]}
                  onPress={() => chooseWinner(campaign.id)}
                >
                  <Text style={styles.battleVoteText}>{index === 0 ? "A wins" : "B wins"}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.battleStatusText}>Now playing: {activeCampaign?.title}</Text>
            <Text style={styles.battleTimer}>{activeSeconds}</Text>
            <Text style={styles.battleTimerLabel}>seconds left</Text>
          </>
        )}
      </View>
      <Pressable style={styles.skipButton} onPress={onBattleSkip}>
        <Text style={styles.skipText}>Complete Play</Text>
      </Pressable>
    </View>
  );
}

function BattlePane({
  campaign,
  side,
  active,
  listened,
  resetKey
}: {
  campaign: Campaign;
  side: string;
  active: boolean;
  listened: boolean;
  resetKey: number;
}) {
  const source = getMediaSource(campaign.url, campaign.mediaKind);
  function openBattleLink() {
    if (!campaign.externalLink) {
      Alert.alert("No link", "This media does not have a link attached.");
      return;
    }
    if (Platform.OS === "web") {
      window.open(campaign.externalLink, "_blank", "noopener,noreferrer");
      return;
    }
    Linking.openURL(campaign.externalLink);
  }

  return (
    <View style={[styles.battlePane, active && styles.battlePaneActive]}>
      <Text style={styles.battleSideLabel}>Media {side}</Text>
      <Text numberOfLines={2} style={styles.battlePaneTitle}>{campaign.title}</Text>
      <Text style={styles.battleCategoryBadge}>{campaign.category}</Text>
      <View style={styles.battlePlayerSlot}>
        {active ? (
          <EmbeddedMedia key={`${campaign.id}-${side}-${resetKey}`} source={source} />
        ) : campaign.thumbnailUrl ? (
          <Image source={{ uri: campaign.thumbnailUrl }} style={styles.battleThumb} />
        ) : (
          <View style={styles.battleLogoFill}>
            <Image source={require("./assets/swap-plays-symbol-white.png")} style={styles.battleDefaultLogo} />
          </View>
        )}
      </View>
      <View style={[styles.battleListenBadge, listened && styles.battleListenBadgeDone]}>
        <Ionicons name={listened ? "checkmark-circle" : active ? "volume-high" : "time-outline"} size={16} color={listened ? "#39cc70" : "#fff"} />
        <Text style={[styles.battleListenText, listened && styles.battleListenTextDone]}>{listened ? "15 sec complete" : active ? "Listening" : "Waiting"}</Text>
      </View>
      <Pressable style={[styles.battleLinkButton, !campaign.externalLink && styles.battleLinkButtonDisabled]} onPress={openBattleLink}>
        <Ionicons name="link" size={16} color={campaign.externalLink ? "#1d8af0" : "#9aa4b2"} />
        <Text style={[styles.battleLinkText, !campaign.externalLink && styles.battleLinkTextDisabled]}>Link</Text>
      </Pressable>
    </View>
  );
}

function EmbeddedMedia({ source }: { source: { kind: string; url: string } }) {
  if (Platform.OS !== "web") {
    return (
      <View style={styles.embeddedFallback}>
        <Ionicons name="play-circle" size={42} color="#fff" />
        <Text style={styles.embeddedFallbackText}>Player ready</Text>
      </View>
    );
  }

  if (source.kind === "restricted") {
    return (
      <View style={styles.embeddedFallback}>
        <Ionicons name="alert-circle" size={42} color="#fff" />
        <Text style={styles.embeddedFallbackText}>Instagram links cannot play inside this app.</Text>
      </View>
    );
  }

  const sharedStyle = {
    border: "0",
    borderRadius: 8,
    height: "100%",
    width: "100%"
  };

  if (source.kind === "audio") {
    return (
      <View style={styles.embeddedPlayer}>
        {React.createElement("audio", {
          autoPlay: true,
          controls: true,
          src: source.url,
          style: { width: "92%" }
        })}
      </View>
    );
  }

  if (source.kind === "video") {
    return (
      <View style={styles.embeddedPlayer}>
        {React.createElement("video", {
          autoPlay: true,
          controls: true,
          src: source.url,
          style: sharedStyle
        })}
      </View>
    );
  }

  return (
    <View style={styles.embeddedPlayer}>
      {React.createElement("iframe", {
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
        allowFullScreen: true,
        referrerPolicy: "strict-origin-when-cross-origin",
        sandbox: "allow-scripts allow-same-origin allow-forms allow-presentation",
        src: source.url,
        style: sharedStyle,
        title: "Media player"
      })}
    </View>
  );
}

const pointRewardOptions = [
  { label: "5,000", points: 5000, passCode: "SP-5000" },
  { label: "10,000", points: 10000, passCode: "SP-10000" },
  { label: "25,000", points: 25000, passCode: "SP-25000" },
  { label: "50,000", points: 50000, passCode: "SP-50000" }
];
type PointRewardOption = (typeof pointRewardOptions)[number];

function RedeemScreen({ points, badge, onRedeem }: { points: number; badge: string; onRedeem: (amount: number) => void }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedReward, setSelectedReward] = useState<PointRewardOption | null>(null);
  const [passCode, setPassCode] = useState("");
  const [passCodeError, setPassCodeError] = useState("");

  function submitPointRedemption(option: PointRewardOption) {
    const request = {
      pointsAdded: option.points,
      newBalance: points + option.points,
      requestedAt: new Date().toISOString()
    };
    console.log("Point redemption completed", request);
  }

  function openPassCodePrompt(option: PointRewardOption) {
    setSelectedReward(option);
    setPassCode("");
    setPassCodeError("");
    setError("");
    setSuccess("");
  }

  function closePassCodePrompt() {
    setSelectedReward(null);
    setPassCode("");
    setPassCodeError("");
  }

  function redeemPoints(option: PointRewardOption) {
    if (passCode.trim().toUpperCase() !== option.passCode) {
      setPassCodeError("Enter a valid pass code to redeem these points.");
      return;
    }
    setError("");
    setSuccess(`${option.points.toLocaleString()} points added to your balance.`);
    onRedeem(option.points);
    submitPointRedemption(option);
    closePassCodePrompt();
    Alert.alert("Points redeemed", `${option.points.toLocaleString()} points were added to your balance.`);
  }

  return (
    <View style={styles.redeemScreen}>
      <ScrollView contentContainerStyle={styles.redeemInner}>
        <View style={styles.redeemHero}>
          <MaterialCommunityIcons name="plus-circle-outline" size={28} color="#fff" />
          <Text style={styles.redeemTitle}>More Points</Text>
          <Text style={styles.redeemCopy}>Redeem rewards for more points to create more play campaigns.</Text>
          <View style={styles.redeemBalance}>
            <BadgeIcon badge={badge} />
            <Text style={styles.redeemBalanceText}>{points.toLocaleString()} points available</Text>
            {badge === "coin" ? <Text style={styles.redeemBadgeText}>No badge yet</Text> : <Text style={styles.redeemBadgeText}>{badge} badge</Text>}
          </View>
        </View>
        <View style={styles.giftGrid}>
          {pointRewardOptions.map((option) => {
            return (
              <Pressable
                key={option.label}
                style={styles.giftCard}
                onPress={() => openPassCodePrompt(option)}
              >
                <View style={styles.giftIconWrap}>
                  <Ionicons name="add-circle-outline" size={22} color="#1d8af0" />
                </View>
                <Text style={styles.giftValue}>{option.label}</Text>
                <Text style={styles.giftCost}>points</Text>
                <View style={styles.giftButton}>
                  <Text style={styles.giftButtonText}>Enter Pass Code</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.redeemFootnote}>A valid pass code is required before points are added to your balance.</Text>
      </ScrollView>
      <Modal visible={Boolean(selectedReward)} transparent animationType="fade" onRequestClose={closePassCodePrompt}>
        <View style={styles.passCodeBackdrop}>
          <View style={styles.passCodeCard}>
            <Pressable style={styles.passCodeClose} onPress={closePassCodePrompt}>
              <Ionicons name="close" size={22} color="#111318" />
            </Pressable>
            <View style={styles.giftIconWrap}>
              <Ionicons name="key-outline" size={22} color="#1d8af0" />
            </View>
            <Text style={styles.passCodeTitle}>Pass Code Required</Text>
            <Text style={styles.passCodeCopy}>Enter the pass code for {selectedReward?.label} points.</Text>
            <TextInput
              value={passCode}
              onChangeText={(value) => {
                setPassCode(value);
                if (passCodeError) setPassCodeError("");
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="Pass code"
              placeholderTextColor="#7a818e"
              style={[styles.passCodeInput, passCodeError && styles.passCodeInputError]}
            />
            {passCodeError ? (
              <View style={styles.permissionErrorRow}>
                <Ionicons name="alert-circle" size={18} color="#d93025" />
                <Text style={styles.permissionErrorText}>{passCodeError}</Text>
              </View>
            ) : null}
            <Pressable
              style={styles.passCodeButton}
              onPress={() => {
                if (selectedReward) redeemPoints(selectedReward);
              }}
            >
              <Text style={styles.passCodeButtonText}>Redeem Points</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {error ? (
        <View style={[styles.redeemNoticeFloating, styles.redeemError]}>
          <Ionicons name="alert-circle" size={18} color="#d93025" />
          <Text style={styles.redeemErrorText}>{error}</Text>
        </View>
      ) : null}
      {success ? (
        <View style={[styles.redeemNoticeFloating, styles.redeemSuccess]}>
          <Ionicons name="checkmark-circle" size={18} color="#148c45" />
          <Text style={styles.redeemSuccessText}>{success}</Text>
        </View>
      ) : null}
    </View>
  );
}

function InviteScreen() {
  const link = "https://swapplays.app/ref/7n18shzz";
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      if (Platform.OS === "web" && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        Alert.alert("Copy link", link);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      Alert.alert("Copy link", link);
    }
  }

  return (
    <View style={styles.formScreen}>
      <Text style={styles.inviteHeadline}>Invite your friends and earn 300 coins for each referral.</Text>
      <Text style={styles.refLink}>{link}</Text>
      <View style={styles.inviteButtonRow}>
        <Pressable style={styles.primaryPill} onPress={() => Share.share({ message: `Join Swap Plays: ${link}` })}>
          <Text style={styles.primaryPillText}>Share</Text>
        </Pressable>
        <Pressable style={styles.copyPill} onPress={copyLink}>
          <Ionicons name="copy-outline" size={18} color="#1d8af0" />
          <Text style={styles.copyPillText}>Copy Link</Text>
        </Pressable>
      </View>
      {copied ? (
        <View style={styles.copyNotice}>
          <Ionicons name="checkmark-circle" size={16} color="#148c45" />
          <Text style={styles.copyNoticeText}>Referral link copied.</Text>
        </View>
      ) : null}
      <Text style={styles.tipText}>If you do not have a referral, invite your friends to earn coins. Referral points can be used to create more campaigns.</Text>
    </View>
  );
}

function AwardsScreen({ overallPoints, onAwardPress }: { overallPoints: number; onAwardPress: (badge: string) => void }) {
  const earnedAwards = plaqueMilestones.map((award) => ({
    id: award.tier,
    title: award.tier === "gold" ? "Gold Badge" : award.tier === "platinum" ? "Platinum Badge" : "Diamond Badge",
    requirement: award.points,
    badge: award.tier,
    image: award.image,
    earned: overallPoints >= award.points
  }));
  const futureAwards = Array.from({ length: 5 }, (_, index) => ({
    id: `future-${index + 1}`,
    title: "Unlock",
    requirement: 0,
    badge: "",
    image: 0,
    earned: false
  }));
  const awards = [...earnedAwards, ...futureAwards];

  return (
    <ScrollView style={styles.awardsScreen} contentContainerStyle={styles.awardsInner}>
      <View style={styles.awardsHero}>
        <Text style={styles.awardsEyebrow}>Achievement Archive</Text>
        <Text style={styles.awardsTitle}>Awards Wall</Text>
        <Text style={styles.awardsCopy}>Every badge and future accomplishment you unlock will live here.</Text>
      </View>
      <View style={styles.awardsGrid}>
        {awards.map((award) => (
          <Pressable
            key={award.id}
            disabled={!award.badge}
            onPress={() => award.badge && onAwardPress(award.badge)}
            style={[styles.awardCard, award.earned && styles.awardCardEarned]}
          >
            <View style={[styles.awardPlaqueStage, !award.earned && award.badge && styles.awardPlaqueStageLocked]}>
              {award.image ? (
                <Image source={award.image} style={[styles.awardPlaqueImage, !award.earned && styles.awardPlaqueImageLocked]} />
              ) : (
                <View style={styles.awardUnlockSlot}>
                  <Ionicons name="lock-closed" size={30} color="#6f7a89" />
                </View>
              )}
            </View>
            <Text style={styles.awardTitle}>{award.title}</Text>
            <Text style={styles.awardMeta}>
              {award.badge ? `${award.requirement.toLocaleString()} points` : "Future accomplishment"}
            </Text>
            <View style={[styles.awardStatus, award.earned && styles.awardStatusEarned]}>
              <Text style={[styles.awardStatusText, award.earned && styles.awardStatusTextEarned]}>
                {award.earned ? "Unlocked" : award.badge ? "Locked" : "Unlock"}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function HowScreen({ onPlaquePress }: { onPlaquePress: (badge: string) => void }) {
  return (
    <ScrollView style={styles.how} contentContainerStyle={styles.howInner}>
      <InfoBlock title="Promote Media" copy="Collect points by listening to or watching media from other users. Spend those points to create campaigns that promote your own music, videos, podcasts, or shows." />
      <InfoBlock title="Uploads" copy="Upload your media and users can play your content inside the app and earn points after completing the play campaign." />
      <BadgesInfoBlock onPlaquePress={onPlaquePress} />
      <InfoBlock title="Autoplay" copy="Autoplay lets listeners move through campaigns faster. Autoplay Plus can be connected to in-app purchases when store products are configured." />
    </ScrollView>
  );
}

function BadgesInfoBlock({ onPlaquePress }: { onPlaquePress: (badge: string) => void }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoTitle}>Badges</Text>
      <View style={styles.badgeCopyWrap}>
        <Pressable style={styles.badgeCopyItem} onPress={() => onPlaquePress("gold")}>
          <BadgeIcon badge="gold" />
          <Text style={styles.infoCopy}>Gold unlocks at 500,000 overall points</Text>
        </Pressable>
        <Pressable style={styles.badgeCopyItem} onPress={() => onPlaquePress("platinum")}>
          <BadgeIcon badge="platinum" />
          <Text style={styles.infoCopy}>Platinum at 1,000,000</Text>
        </Pressable>
        <Pressable style={styles.badgeCopyItem} onPress={() => onPlaquePress("diamond")}>
          <BadgeIcon badge="diamond" />
          <Text style={styles.infoCopy}>Diamond at 10,000,000</Text>
        </Pressable>
      </View>
      <Text style={[styles.infoCopy, styles.badgeCopyFooter]}>Badges stay after they are earned.</Text>
    </View>
  );
}

function InfoBlock({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoCopy}>{copy}</Text>
    </View>
  );
}

const leaderAvatarImages = [
  require("./assets/leader-avatar-1.png"),
  require("./assets/leader-avatar-2.png"),
  require("./assets/leader-avatar-3.png"),
  require("./assets/leader-avatar-4.png"),
  require("./assets/leader-avatar-5.png"),
  require("./assets/leader-avatar-6.png")
];

function sampleAvatarImage(seed: number) {
  return leaderAvatarImages[seed % leaderAvatarImages.length];
}

const leaderboardUsers = Array.from({ length: 100 }, (_, index) => {
  const name = index === 0 ? "Swap Plays User" : `Creator ${index + 1}`;
  return {
    id: `leader-${index + 1}`,
    name,
    plays: Math.max(1200, 98500 - index * 731),
    points: Math.max(25000, 2400000 - index * 18425),
    photo: sampleAvatarImage(index),
    externalLink: `https://swapplays.com/creator/${index + 1}`
  };
});

function LeaderboardScreen({ campaigns, profileName, profilePhoto, profileLink, overallPoints }: { campaigns: Campaign[]; profileName: string; profilePhoto: string; profileLink: string; overallPoints: number }) {
  const [mode, setMode] = useState<"plays" | "points">("plays");
  type LeaderboardRow = {
    id: string;
    name: string;
    plays: number;
    points: number;
    category?: MediaCategory;
    photo: string | number;
    externalLink: string;
  };
  const campaignRows: LeaderboardRow[] = [
    ...campaigns.map((campaign, index) => ({
      id: campaign.id,
      name: campaign.title,
      plays: campaign.playsDone,
      points: 0,
      category: campaign.category,
      photo: profilePhoto || campaign.thumbnailUrl || sampleAvatarImage(index),
      externalLink: campaign.externalLink || ""
    })),
    ...Array.from({ length: Math.max(0, 100 - campaigns.length) }, (_, index) => {
      const name = index === 0 ? "Creator Media Promo" : `Campaign ${index + 2}`;
      return {
        id: `campaign-leader-${index + 1}`,
        name,
        plays: Math.max(1000, 98500 - index * 731),
        points: 0,
        category: mediaCategories[index % mediaCategories.length],
        photo: sampleAvatarImage(index + campaigns.length),
        externalLink: ""
      };
    })
  ].sort((a, b) => b.plays - a.plays).slice(0, 100);
  const pointRows: LeaderboardRow[] = leaderboardUsers.map((user, index) => (
    index === 0 ? { ...user, name: profileName, points: overallPoints, photo: profilePhoto || user.photo, externalLink: profileLink.trim() } : user
  )).sort((a, b) => b.points - a.points);
  const rows: LeaderboardRow[] = mode === "plays" ? campaignRows : pointRows;
  function openLeaderboardLink(link?: string) {
    if (!link) {
      Alert.alert("No link", mode === "plays" ? "This campaign does not have a song link attached." : "This user does not have a profile link attached.");
      return;
    }
    if (Platform.OS === "web") {
      window.open(link, "_blank", "noopener,noreferrer");
      return;
    }
    Linking.openURL(link);
  }

  return (
    <View style={styles.leaderboardScreen}>
      <View style={styles.leaderboardHero}>
        <Text style={styles.leaderboardEyebrow}>Top 100</Text>
        <Text style={styles.leaderboardTitle}>{mode === "plays" ? "Most Plays" : "Most Points"}</Text>
      </View>
      <View style={styles.leaderboardToggle}>
        <Pressable style={[styles.leaderboardToggleButton, mode === "plays" && styles.leaderboardToggleActive]} onPress={() => setMode("plays")}>
          <Ionicons name="play" size={16} color={mode === "plays" ? "#fff" : "#1d8af0"} />
          <Text style={[styles.leaderboardToggleText, mode === "plays" && styles.leaderboardToggleTextActive]}>Top Plays</Text>
        </Pressable>
        <Pressable style={[styles.leaderboardToggleButton, mode === "points" && styles.leaderboardToggleActive]} onPress={() => setMode("points")}>
          <Ionicons name="trophy" size={16} color={mode === "points" ? "#fff" : "#1d8af0"} />
          <Text style={[styles.leaderboardToggleText, mode === "points" && styles.leaderboardToggleTextActive]}>Top Points</Text>
        </Pressable>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.leaderboardList}
        renderItem={({ item, index }) => (
          <View style={styles.leaderboardRow}>
            <View style={[styles.leaderRank, index < 3 && styles.leaderRankTop]}>
              <Text style={[styles.leaderRankText, index < 3 && styles.leaderRankTopText]}>{index + 1}</Text>
            </View>
            <View style={styles.leaderAvatar}>
              {item.photo ? (
                <Image source={typeof item.photo === "string" ? { uri: item.photo } : item.photo} style={styles.leaderAvatarImage} />
              ) : (
                <Text style={styles.leaderAvatarText}>{item.name.slice(0, 1)}</Text>
              )}
            </View>
            <View style={styles.leaderBody}>
              <Text numberOfLines={1} style={styles.leaderName}>{item.name}</Text>
              {mode === "plays" && item.category ? (
                <View style={styles.leaderCategoryRow}>
                  <Text style={styles.leaderCategoryBadge}>{item.category}</Text>
                  <Text style={styles.leaderSub}>{item.plays.toLocaleString()} plays</Text>
                </View>
              ) : (
                <Text style={styles.leaderSub}>{item.points.toLocaleString()} points</Text>
              )}
            </View>
            {mode === "plays" ? (
              <Pressable
                style={[styles.leaderLinkButton, !item.externalLink && styles.leaderLinkButtonDisabled]}
                onPress={() => openLeaderboardLink(item.externalLink)}
              >
                <Ionicons name="link" size={18} color={item.externalLink ? "#1d8af0" : "#aeb5c0"} />
                <Text style={[styles.leaderLinkText, !item.externalLink && styles.leaderLinkTextDisabled]}>Link</Text>
              </Pressable>
            ) : (
              <View style={styles.leaderActions}>
                <Pressable
                  style={[styles.leaderLinkButton, !item.externalLink && styles.leaderLinkButtonDisabled]}
                  onPress={() => openLeaderboardLink(item.externalLink)}
                >
                  <Ionicons name="link" size={18} color={item.externalLink ? "#1d8af0" : "#aeb5c0"} />
                  <Text style={[styles.leaderLinkText, !item.externalLink && styles.leaderLinkTextDisabled]}>Link</Text>
                </Pressable>
                <View style={styles.leaderBadge}>
                  <BadgeIcon badge={badgeForPoints(item.points)} />
                </View>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

function BottomTabs({ active, onChange }: { active: TabName; onChange: (tab: TabName) => void }) {
  const tabMotion = useRef(new Animated.Value(0)).current;
  const tabs: Array<{ key: TabName; label: string; icon?: keyof typeof Ionicons.glyphMap; image?: number }> = [
    { key: "campaigns", label: "Swap Plays", image: require("./assets/swap-plays-symbol-transparent.png") },
    { key: "play", label: "Play", icon: "play" },
    { key: "leaderboard", label: "Top Plays", icon: "trophy" }
  ];

  useEffect(() => {
    tabMotion.setValue(0);
    Animated.spring(tabMotion, {
      toValue: 1,
      friction: 4,
      tension: 90,
      useNativeDriver: true
    }).start();
  }, [active, tabMotion]);

  const flipRotation = tabMotion.interpolate({ inputRange: [0, 1], outputRange: ["-180deg", "0deg"] });
  const playSlide = tabMotion.interpolate({ inputRange: [0, 0.55, 1], outputRange: [-13, 5, 0] });
  const playScale = tabMotion.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.72, 1.22, 1] });
  const activeScale = tabMotion.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  return (
    <View style={styles.bottomTabs}>
      {tabs.map((item) => (
        <Pressable key={item.key} style={styles.bottomTab} onPress={() => onChange(item.key)}>
          <Animated.View
            style={[
              styles.bottomIconMotion,
              active === item.key && {
                transform: item.key === "campaigns"
                  ? [{ perspective: 600 }, { rotateY: flipRotation }, { scale: activeScale }]
                  : [{ translateX: playSlide }, { scale: playScale }]
              }
            ]}
          >
            {item.image ? (
              <Image source={item.image} style={[styles.bottomBrandLogo, active !== item.key && styles.bottomLogoInactive]} />
            ) : (
              <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={25} color={active === item.key ? "#1d8af0" : "#aeb5c0"} />
            )}
          </Animated.View>
          <Text style={[styles.bottomText, active === item.key && styles.bottomTextActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ProfileDrawer({
  open,
  points,
  overallPoints,
  badge,
  autoplay,
  profileName,
  profileEmail,
  profilePhoto,
  profileLink,
  onProfileNameChange,
  onProfilePhotoChange,
  onProfileLinkChange,
  onBadgePress,
  onClose,
  onNavigate,
  onWatchAds,
  onAutoplay,
  onLogout
}: {
  open: boolean;
  points: number;
  overallPoints: number;
  badge: string;
  autoplay: boolean;
  profileName: string;
  profileEmail: string;
  profilePhoto: string;
  profileLink: string;
  onProfileNameChange: (name: string) => void;
  onProfilePhotoChange: (photo: string) => void;
  onProfileLinkChange: (link: string) => void;
  onBadgePress: () => void;
  onClose: () => void;
  onNavigate: (tab: TabName) => void;
  onWatchAds: () => void;
  onAutoplay: () => void;
  onLogout: () => void;
}) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [profileLinkError, setProfileLinkError] = useState("");
  const cleanName = profileName.trim() || "Swap Plays User";
  const trimmedProfileLink = profileLink.trim();

  function updateProfileLink(value: string) {
    onProfileLinkChange(value);
    if (!value.trim() || isLikelyUrl(value)) {
      setProfileLinkError("");
      return;
    }
    setProfileLinkError("Enter a valid link starting with http:// or https://.");
  }

  function pickProfilePhoto() {
    if (Platform.OS !== "web") {
      Alert.alert("Upload photo", "Photo upload is available in the web preview right now.");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onProfilePhotoChange(reader.result);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.drawerBackdrop}>
        <Pressable style={styles.drawerShade} onPress={onClose} />
        <View style={styles.drawer}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerScrollContent}>
            <View style={styles.profileHeader}>
              <View>
                <Pressable style={styles.avatarWrap} onPress={pickProfilePhoto}>
                  <View style={styles.avatar}>
                    {profilePhoto ? (
                      <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>{cleanName.slice(0, 1).toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={styles.avatarEditBadge}>
                    <Ionicons name="camera" size={13} color="#fff" />
                  </View>
                </Pressable>
                <TextInput
                  value={profileName}
                  onChangeText={onProfileNameChange}
                  placeholder="User name"
                  style={styles.profileNameInput}
                />
                <TextInput
                  value={profileLink}
                  onChangeText={updateProfileLink}
                  placeholder="Profile or song link"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={[styles.profileLinkInput, profileLinkError && styles.profileLinkInputError]}
                />
                {profileLinkError ? (
                  <View style={styles.profileLinkErrorRow}>
                    <Ionicons name="alert-circle" size={16} color="#d93025" />
                    <Text style={styles.profileLinkErrorText}>{profileLinkError}</Text>
                  </View>
                ) : trimmedProfileLink ? (
                  <View style={styles.profileLinkReadyRow}>
                    <Ionicons name="link" size={16} color="#148c45" />
                    <Text style={styles.profileLinkReadyText}>This link will show on your Top Points row.</Text>
                  </View>
                ) : null}
                <Text style={styles.profileEmail}>{profileEmail}</Text>
              </View>
              <Pressable style={styles.privacyInfoButton} onPress={() => setPrivacyOpen(true)}>
                <Ionicons name="information-circle" size={19} color="#fff" />
              </Pressable>
            </View>
            <View style={styles.drawerPoints}>
              <View>
                <Text style={styles.drawerLabel}>Overall points</Text>
                <Text style={styles.drawerSub}>Campaign points: {points}</Text>
              </View>
              <View style={styles.overallBubble}><Text style={styles.overallBubbleText}>{overallPoints}</Text></View>
            </View>
            <Pressable style={styles.badgeLine} disabled={badge === "coin"} onPress={onBadgePress}>
              <BadgeIcon badge={badge} />
              <Text style={styles.drawerSub}>{badge === "coin" ? "No badge yet" : `${badge.toUpperCase()} badge`}</Text>
            </Pressable>
            <DrawerItem label="Home" onPress={() => onNavigate("campaigns")} />
            <DrawerItem label="Awards" onPress={() => onNavigate("awards")} />
            <DrawerItem label="Redeem Points" onPress={() => onNavigate("redeem")} />
            <DrawerItem label="Invite Friends" onPress={() => onNavigate("invite")} />
            <DrawerItem label="How it works" onPress={() => onNavigate("how")} />
            <DrawerItem label="Watch ads (earn points)" onPress={onWatchAds} />
            <DrawerItem label={autoplay ? "Autoplay active" : "Buy Autoplay"} onPress={onAutoplay} />
            <DrawerItem label="Logout" onPress={onLogout} />
          </ScrollView>
        </View>
        <PrivacyPolicyModal visible={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      </View>
    </Modal>
  );
}

function PrivacyPolicyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.privacyCard}>
          <View style={styles.privacyHeader}>
            <Text style={styles.privacyTitle}>Swap Plays Privacy Policy</Text>
            <Pressable style={styles.privacyClose} onPress={onClose}>
              <Ionicons name="close" size={22} color="#111318" />
            </Pressable>
          </View>
          <ScrollView style={styles.privacyBody}>
            <Text style={styles.privacyCopy}>Swap Plays uses account information, uploaded media, campaign activity, points, rewards, and app usage data to operate the app, show media campaigns, track plays, process rewards, and improve the service.</Text>
            <Text style={styles.privacyCopy}>Uploaded media should be content you own or have permission to promote. Optional links are shown so listeners can visit the page you provide.</Text>
            <Text style={styles.privacyCopy}>Reward requests may be reviewed by Swap Plays support at Service@swapplays.com. We do not sell personal information.</Text>
            <Text style={styles.privacyCopy}>By using Swap Plays, users agree that play activity, points, campaign progress, and reward requests may be stored and reviewed to prevent abuse and keep the platform fair.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DrawerItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.drawerItem} onPress={onPress}>
      <Text style={styles.drawerItemText}>{label}</Text>
    </Pressable>
  );
}

function AutoplayModal({ visible, onClose, onBuy, notice }: { visible: boolean; onClose: () => void; onBuy: (plan: AutoplayPlanId) => Promise<string | void>; notice: string }) {
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [buyingPlan, setBuyingPlan] = useState<AutoplayPlanId | null>(null);
  const [error, setError] = useState("");

  async function buyPlan(plan: AutoplayPlanId) {
    setError("");
    setBuyingPlan(plan);
    const message = await onBuy(plan);
    if (message) setError(message);
    setBuyingPlan(null);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.autoplayCard}>
          <Image source={require("./assets/swap-plays-logo-transparent.png")} style={styles.modalLogo} />
          <Text style={styles.modalTitle}>Autoplay</Text>
          <View style={styles.planRow}>
            <Plan id="week" price="$9.99" label="one week" activePlan={activePlan} setActivePlan={setActivePlan} onPress={() => buyPlan("week")} disabled={Boolean(buyingPlan)} loading={buyingPlan === "week"} />
            <Plan id="month" price="$36.99" label="one month" activePlan={activePlan} setActivePlan={setActivePlan} onPress={() => buyPlan("month")} disabled={Boolean(buyingPlan)} loading={buyingPlan === "month"} dark />
          </View>
          <Pressable
            style={[styles.plusPlan, activePlan === "plus" && styles.planActive]}
            onHoverIn={() => setActivePlan("plus")}
            onHoverOut={() => setActivePlan(null)}
            onPressIn={() => setActivePlan("plus")}
            onPressOut={() => setActivePlan(null)}
            onFocus={() => setActivePlan("plus")}
            onBlur={() => setActivePlan(null)}
            disabled={Boolean(buyingPlan)}
            onPress={() => buyPlan("plus")}
          >
            <Text style={styles.plusPrice}>$399.99</Text>
            <Text style={styles.plusLabel}>yearly subscription with no ads</Text>
            <Text style={styles.plusCta}>{buyingPlan === "plus" ? "Opening PayPal..." : "Get Autoplay Plus"}</Text>
          </Pressable>
          {error || notice ? (
            <Text style={[styles.paypalModalNotice, error && styles.paypalModalError]}>{error || notice}</Text>
          ) : null}
          <Pressable style={styles.noThanks} onPress={onClose}>
            <Text style={styles.noThanksText}>No, Thanks!</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Plan({
  id,
  price,
  label,
  dark,
  activePlan,
  setActivePlan,
  onPress,
  disabled,
  loading
}: {
  id: string;
  price: string;
  label: string;
  dark?: boolean;
  activePlan: string | null;
  setActivePlan: (id: string | null) => void;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const active = activePlan === id;
  return (
    <Pressable
      style={[styles.plan, dark && styles.planDark, active && styles.planActive]}
      onHoverIn={() => setActivePlan(id)}
      onHoverOut={() => setActivePlan(null)}
      onPressIn={() => setActivePlan(id)}
      onPressOut={() => setActivePlan(null)}
      onFocus={() => setActivePlan(id)}
      onBlur={() => setActivePlan(null)}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={[styles.planPrice, dark && styles.planDarkText]}>{price}</Text>
      <Text style={[styles.planText, dark && styles.planDarkText]}>for {label}</Text>
      <Text style={styles.planCta}>{loading ? "Opening PayPal..." : "Get Autoplay"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  app: { flex: 1, backgroundColor: "#f6f8fb" },
  loadingScreen: { flex: 1, backgroundColor: "#050506", alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#fff", fontSize: 22, fontWeight: "900" },
  loginScreen: { flex: 1, backgroundColor: "#050506" },
  loginScroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
  loginArtwork: { alignSelf: "center", overflow: "hidden" },
  loginArtworkImage: { borderRadius: 0 },
  loginRealCard: { position: "absolute", left: "4.8%", right: "4.8%", top: "54.2%", minHeight: "37.4%", zIndex: 30, borderRadius: 17, backgroundColor: "#fff", padding: 10, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 9 } },
  loginRealModeRow: { flexDirection: "row", gap: 12, marginBottom: 7 },
  loginRealModeButton: { flex: 1, minHeight: 37, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  loginRealModeDark: { backgroundColor: "#2d8cf0", borderColor: "#1f6fd3", shadowColor: "#2d8cf0", shadowOpacity: 0.32, shadowRadius: 11, shadowOffset: { width: 0, height: 6 } },
  loginRealModeLight: { backgroundColor: "#fff", borderColor: "#111318" },
  loginRealModeText: { fontSize: 16, fontWeight: "900" },
  loginRealModeTextDark: { color: "#fff" },
  loginRealModeTextLight: { color: "#111318" },
  loginRealInputRow: { minHeight: 38, borderRadius: 8, borderWidth: 1.3, borderColor: "#bfc4cc", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, marginBottom: 6, backgroundColor: "#fff" },
  loginRealInput: { flex: 1, minHeight: 35, color: "#111318", fontSize: 15, fontWeight: "600", padding: 0 },
  loginRealError: { minHeight: 24, borderRadius: 8, backgroundColor: "#fdecec", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, marginBottom: 6 },
  loginRealSubmitButton: { minHeight: 40, borderRadius: 8, backgroundColor: "#07090d", alignItems: "center", justifyContent: "center", marginTop: 1 },
  loginButtonDisabled: { opacity: 0.62 },
  loginGoogleButton: { minHeight: 33, borderRadius: 8, borderWidth: 1.3, borderColor: "#c5cbd4", backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6 },
  loginGoogleIcon: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#d9dee7" },
  loginGoogleIconText: { color: "#2d8cf0", fontSize: 14, fontWeight: "900" },
  loginGoogleText: { color: "#111318", fontSize: 13, fontWeight: "900" },
  loginRealFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 5 },
  loginRealFooterText: { color: "#050608", fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },
  loginHotspot: { position: "absolute", zIndex: 5, backgroundColor: "rgba(255,255,255,0.01)" },
  loginArtworkModeButton: { position: "absolute", top: "56.1%", height: "6.2%", zIndex: 20, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  loginArtworkModeLogin: { left: "7.5%", width: "42.5%" },
  loginArtworkModeCreate: { left: "52%", width: "40.5%" },
  loginArtworkModeDark: { backgroundColor: "#07090d", borderWidth: 1.5, borderColor: "#07090d" },
  loginArtworkModeLight: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#111318" },
  loginArtworkModeSelected: { borderColor: "#2d8df0", borderWidth: 2, shadowColor: "#2d8df0", shadowOpacity: 0.42, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  loginArtworkModeText: { fontSize: 16, fontWeight: "900" },
  loginArtworkModeTextDark: { color: "#fff" },
  loginArtworkModeTextLight: { color: "#111318" },
  loginArtworkSubmitButton: { position: "absolute", left: "7.5%", top: "79.8%", width: "85%", height: "6.9%", zIndex: 20, borderRadius: 7, backgroundColor: "#07090d", alignItems: "center", justifyContent: "center" },
  loginArtworkSubmitText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  loginHotspotForgot: { left: "7.5%", top: "88.1%", width: "28%", height: "4.4%" },
  loginHotspotGuest: { right: "7.5%", top: "88.1%", width: "32%", height: "4.4%" },
  loginArtworkInput: { position: "absolute", left: "15.8%", width: "75%", height: "5.3%", zIndex: 21, color: "#111318", fontSize: 17, fontWeight: "600", padding: 0, backgroundColor: "rgba(255,255,255,0.01)" },
  loginArtworkEmail: { top: "64.1%" },
  loginArtworkPassword: { top: "71.8%" },
  loginArtworkError: { position: "absolute", left: "7.5%", right: "7.5%", top: "75.9%", zIndex: 7, minHeight: 28, borderRadius: 8, backgroundColor: "#fdecec", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10 },
  loginPoster: { width: "100%", maxWidth: 520, alignSelf: "center", borderRadius: 20, backgroundColor: "#fff", padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#d8e0ec", shadowColor: "#0b1220", shadowOpacity: 0.16, shadowRadius: 22, shadowOffset: { width: 0, height: 12 } },
  loginHeroCard: { alignSelf: "stretch", borderRadius: 18, backgroundColor: "#050506", paddingHorizontal: 18, paddingVertical: 28, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  loginDecorLayer: { ...StyleSheet.absoluteFillObject },
  loginDecorPlayCircle: { position: "absolute", width: 82, height: 82, borderRadius: 41, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center", opacity: 0.96 },
  loginDecorPlayLeft: { top: 72, left: 20, transform: [{ rotate: "-9deg" }] },
  loginDecorVideoTile: { position: "absolute", width: 88, height: 62, borderRadius: 10, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center", opacity: 0.96 },
  loginDecorPlayRight: { top: 88, right: 24, transform: [{ rotate: "10deg" }] },
  loginDecorIcon: { position: "absolute", width: 66, height: 66, alignItems: "center", justifyContent: "center", opacity: 0.94 },
  loginDecorTrophy: { top: 260, left: 30, transform: [{ rotate: "-7deg" }] },
  loginDecorGift: { top: 268, right: 48, transform: [{ rotate: "7deg" }] },
  loginDecorHeadphones: { top: 225, left: 74, transform: [{ rotate: "-10deg" }] },
  loginDecorChart: { top: 286, right: 24, transform: [{ rotate: "6deg" }] },
  loginDecorBolt: { top: 44, right: "24%", transform: [{ rotate: "16deg" }] },
  loginDecorStroke: { position: "absolute", color: "#fff", fontSize: 34, fontWeight: "900", opacity: 0.96 },
  loginDecorStrokeOne: { top: 50, left: "39%", transform: [{ rotate: "-18deg" }] },
  loginDecorStrokeTwo: { top: 45, right: "37%", transform: [{ rotate: "12deg" }] },
  loginDecorStrokeThree: { top: 54, right: "32%", transform: [{ rotate: "-18deg" }] },
  loginDecorMark: { position: "absolute", color: "#fff", fontWeight: "900", opacity: 0.9 },
  loginDecorMarkOne: { top: 65, left: "19%", fontSize: 18, transform: [{ rotate: "-22deg" }] },
  loginDecorMarkTwo: { bottom: 28, left: 22, fontSize: 25 },
  loginDecorMarkThree: { bottom: 56, right: 47, fontSize: 48, transform: [{ rotate: "-18deg" }] },
  loginDecorMarkFour: { top: 310, left: 44, fontSize: 44, transform: [{ rotate: "-30deg" }] },
  loginDecorQuestion: { top: 238, left: 94, fontSize: 24, transform: [{ rotate: "12deg" }] },
  loginDecorTinyCircle: { top: 188, right: 118, fontSize: 23 },
  loginLogoRing: { width: 104, height: 104, borderRadius: 52, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#1d8af0", shadowOpacity: 0.26, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } },
  loginLogo: { width: 78, height: 78, resizeMode: "contain" },
  loginBrand: { color: "#fff", fontSize: 44, fontWeight: "900", marginTop: 16, textAlign: "center", textShadowColor: "rgba(255,255,255,0.12)", textShadowRadius: 8 },
  loginBrandUnderline: { width: 270, height: 5, borderRadius: 3, backgroundColor: "#fff", marginTop: 2, transform: [{ rotate: "-2deg" }] },
  loginHeadline: { color: "#dfe6f2", fontSize: 17, fontWeight: "800", lineHeight: 24, textAlign: "center", marginTop: 10, maxWidth: 330 },
  loginFeatureRow: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 22, flexWrap: "wrap" },
  loginFeatureItem: { minWidth: 94, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 8, paddingHorizontal: 10 },
  loginFeatureIconCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  loginFeaturePill: { minHeight: 38, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.38)", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  loginFeatureText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  loginCard: { alignSelf: "stretch", marginTop: 14, borderRadius: 18, backgroundColor: "#fff", padding: 14, borderWidth: 1, borderColor: "#d8e0ec" },
  loginModeRow: { flexDirection: "row", gap: 14, marginBottom: 14 },
  loginModeButton: { flex: 1, minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: "#cfd8e6", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9 },
  loginModeActive: { backgroundColor: "#1d8af0", borderColor: "#1d8af0", shadowColor: "#1d8af0", shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  loginModeUnderline: { position: "absolute", bottom: 9, width: 62, height: 2, borderRadius: 1, backgroundColor: "#111318", transform: [{ rotate: "-4deg" }] },
  loginModeText: { color: "#111318", fontSize: 15, fontWeight: "900" },
  loginModeTextActive: { color: "#fff" },
  loginInputWrap: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: "#cfd8e6", backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, marginBottom: 9 },
  loginInput: { flex: 1, color: "#111318", fontSize: 16, fontWeight: "900", paddingVertical: 10 },
  loginErrorRow: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 8, backgroundColor: "#fdecec", padding: 9, marginBottom: 9 },
  loginErrorText: { flex: 1, color: "#d93025", fontSize: 13, fontWeight: "800" },
  loginPrimaryButton: { minHeight: 56, borderRadius: 12, backgroundColor: "#1d8af0", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: "#1d8af0", shadowOpacity: 0.24, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, overflow: "hidden" },
  loginPrimaryText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  loginPrimaryPlay: { position: "absolute", right: 18 },
  loginButtonBurst: { position: "absolute", color: "#fff", fontSize: 25, fontWeight: "900", opacity: 0.92 },
  loginButtonBurstLeft: { left: 28, transform: [{ rotate: "18deg" }] },
  loginButtonBurstRight: { right: 60, transform: [{ rotate: "-18deg" }] },
  loginFooterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  loginSmallLink: { color: "#111318", fontSize: 13, fontWeight: "800", textDecorationLine: "underline" },
  loginGuestArrow: { position: "absolute", right: -16, bottom: -5, color: "#111318", fontSize: 20, fontWeight: "900", transform: [{ rotate: "12deg" }] },
  loginLegal: { color: "#9aa0a9", fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 18, paddingHorizontal: 16 },
  header: { height: Platform.OS === "android" ? 86 : 72, backgroundColor: "#050506", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: "#1d1d22" },
  iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, color: "#fff", fontSize: 25, fontWeight: "900", textAlign: "center" },
  pointsPill: { minWidth: 112, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  pointsPillPressable: { minHeight: 44, paddingLeft: 8, borderRadius: 8 },
  pointsText: { color: "#fff", fontSize: 22, fontWeight: "900" },
  pointsNotice: { color: "#39cc70", fontSize: 11, fontWeight: "900", maxWidth: 88 },
  headerBadgeButton: { minWidth: 32, minHeight: 32, alignItems: "center", justifyContent: "center" },
  badgeCircleImage: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: "rgba(255,255,255,0.74)" },
  badgeDiamondImage: { width: 31, height: 25, resizeMode: "contain" },
  recordBadgeIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#060708", borderWidth: 1, borderColor: "rgba(255,255,255,0.42)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  recordBadgeSheen: { position: "absolute", width: 34, height: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.16)", transform: [{ rotate: "-28deg" }] },
  recordBadgeCenter: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: "#17191d", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  recordBadgeDot: { width: 2.5, height: 2.5, borderRadius: 1.25, backgroundColor: "#f8fafc" },
  celebrationOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 50, alignItems: "center", justifyContent: "center" },
  confettiPiece: { position: "absolute", top: 0, borderRadius: 2 },
  celebrationCard: { minWidth: 250, borderRadius: 8, backgroundColor: "#0b0d12", paddingVertical: 22, paddingHorizontal: 26, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
  celebrationTitle: { color: "#fff", fontSize: 28, fontWeight: "900" },
  celebrationCopy: { color: "#39cc70", fontSize: 16, fontWeight: "900", marginTop: 4, textTransform: "uppercase" },
  plaqueBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", alignItems: "center", justifyContent: "center", padding: 14 },
  plaqueCard: { width: "100%", maxWidth: 420, borderRadius: 8, backgroundColor: "#080a0f", padding: 12, alignItems: "center", borderWidth: 1, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.46, shadowRadius: 26, shadowOffset: { width: 0, height: 12 } },
  plaqueClose: { position: "absolute", top: 10, right: 10, zIndex: 3, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  plaqueGlow: { position: "absolute", top: 42, width: 220, height: 220, borderRadius: 110, opacity: 0.9, shadowColor: "#fff", shadowOpacity: 0.26, shadowRadius: 28, shadowOffset: { width: 0, height: 0 } },
  plaqueHeaderRow: { alignSelf: "stretch", flexDirection: "row", alignItems: "center", gap: 7, paddingRight: 38, marginBottom: 8 },
  plaqueDot: { width: 8, height: 8, borderRadius: 4 },
  plaqueImageStage: { width: "100%", borderRadius: 8, backgroundColor: "#020304", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", padding: 6, shadowColor: "#fff", shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  plaqueImage: { width: "100%", height: 300, resizeMode: "contain", borderRadius: 8 },
  plaqueEyebrow: { color: "#cfd6e2", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  plaqueTitle: { color: "#fff", fontSize: 21, fontWeight: "900", textAlign: "center", marginTop: 10 },
  plaqueCopy: { color: "#b8c0cc", fontSize: 13, fontWeight: "700", lineHeight: 18, textAlign: "center", marginTop: 5, paddingHorizontal: 6 },
  plaqueButton: { alignSelf: "stretch", minHeight: 42, borderRadius: 8, backgroundColor: "#1d8af0", alignItems: "center", justifyContent: "center", marginTop: 10, shadowColor: "#1d8af0", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  plaqueButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  screenStack: { flex: 1 },
  screenPane: { flex: 1 },
  activePane: { display: "flex" },
  hiddenPane: { display: "none" },
  content: { flex: 1, backgroundColor: "#f6f8fb" },
  playFixedScreen: { flex: 1, backgroundColor: "#f6f8fb", paddingBottom: 8, overflow: "hidden" },
  listContent: { width: "96%", maxWidth: 900, alignSelf: "center", paddingTop: 14, paddingBottom: 96 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  emptyLogo: { width: 148, height: 98, resizeMode: "contain", opacity: 0.78 },
  emptyTitle: { fontSize: 24, fontWeight: "900", color: "#111318", marginTop: 8 },
  emptyCopy: { color: "#6f7581", textAlign: "center", marginTop: 8, lineHeight: 21 },
  campaignSummary: { minHeight: 86, borderRadius: 8, backgroundColor: "#0b0d12", padding: 14, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  summaryEyebrow: { color: "#79bfff", fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0 },
  summaryTitle: { color: "#fff", fontSize: 21, fontWeight: "900", marginTop: 3 },
  summaryMetric: { minWidth: 78, borderRadius: 8, backgroundColor: "#161a22", alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 10 },
  summaryMetricValue: { color: "#39cc70", fontSize: 21, fontWeight: "900" },
  summaryMetricLabel: { color: "#c7ccd6", fontSize: 11, fontWeight: "800" },
  fab: { position: "absolute", right: 22, bottom: 88, width: 54, height: 54, borderRadius: 27, backgroundColor: "#1d8af0", alignItems: "center", justifyContent: "center", shadowColor: "#1d8af0", shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  campaignRow: { flexDirection: "row", alignItems: "center", padding: 10, marginBottom: 10, borderRadius: 8, backgroundColor: "#fff", shadowColor: "#172033", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  thumb: { width: 56, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 8, overflow: "hidden" },
  thumbImage: { width: "100%", height: "100%", resizeMode: "cover" },
  thumbLogo: { width: 34, height: 34, resizeMode: "contain" },
  rowBody: { flex: 1, marginHorizontal: 10 },
  rowTitle: { fontSize: 15, fontWeight: "900", color: "#111318" },
  rowMetaLine: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 3, flexWrap: "wrap" },
  categoryBadge: { color: "#0b5cad", backgroundColor: "#e6f3ff", borderRadius: 8, overflow: "hidden", paddingHorizontal: 7, paddingVertical: 2, fontSize: 10, fontWeight: "900" },
  rowSub: { fontSize: 11, color: "#7a818e", marginTop: 2, fontWeight: "700" },
  rowCompleteText: { color: "#148c45", fontWeight: "900" },
  progressTrack: { height: 7, backgroundColor: "#e2e7ef", marginTop: 7, borderRadius: 8, overflow: "hidden" },
  progressFill: { height: 7, backgroundColor: "#1d8af0", borderRadius: 8 },
  progressFillComplete: { backgroundColor: "#39cc70" },
  deleteButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff1f1", alignItems: "center", justifyContent: "center" },
  create: { flex: 1, backgroundColor: "#f6f8fb" },
  createInner: { width: "96%", maxWidth: 900, alignSelf: "center", paddingTop: 14, paddingBottom: 18 },
  audioOnlyHeader: { minHeight: 58, borderRadius: 8, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginBottom: 10, shadowColor: "#172033", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  audioOnlyTitle: { color: "#050505", fontSize: 18, fontWeight: "900" },
  linkStatus: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, padding: 10, marginTop: 8 },
  linkStatusEmpty: { backgroundColor: "#eef2f7" },
  linkStatusGood: { backgroundColor: "#eaf8ef" },
  linkStatusError: { backgroundColor: "#fdecec" },
  linkStatusText: { flex: 1, color: "#777", fontSize: 13, fontWeight: "700" },
  linkStatusGoodText: { color: "#148c45" },
  linkStatusErrorText: { color: "#d93025" },
  uploadBox: { minHeight: 60, borderRadius: 8, borderWidth: 1, borderColor: "#d6dde8", backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 10, padding: 10, marginTop: 8, shadowColor: "#172033", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  uploadIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#e6f3ff", alignItems: "center", justifyContent: "center" },
  uploadCopy: { flex: 1 },
  uploadTitle: { color: "#111318", fontSize: 15, fontWeight: "900" },
  uploadSub: { color: "#7a818e", fontSize: 12, fontWeight: "700", marginTop: 2 },
  permissionRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d6dde8" },
  permissionRowError: { borderColor: "#d93025", backgroundColor: "#fff7f6" },
  permissionBox: { width: 23, height: 23, borderRadius: 6, borderWidth: 2, borderColor: "#aeb8c6", alignItems: "center", justifyContent: "center" },
  permissionBoxChecked: { borderColor: "#1d8af0", backgroundColor: "#1d8af0" },
  permissionText: { flex: 1, color: "#414854", fontSize: 13, fontWeight: "800", lineHeight: 17 },
  permissionErrorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 8 },
  permissionErrorText: { flex: 1, color: "#d93025", fontSize: 13, fontWeight: "800", lineHeight: 18 },
  helpText: { color: "#8d8d8d", fontSize: 13, marginTop: 8, marginBottom: 10, lineHeight: 18 },
  sectionTitle: { color: "#414854", fontWeight: "900", fontSize: 14, marginTop: 8, marginBottom: 8, textTransform: "uppercase" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  categoryChip: { minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: "#d6dde8", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  categoryChipActive: { backgroundColor: "#111318", borderColor: "#111318" },
  categoryChipText: { color: "#414854", fontSize: 13, fontWeight: "900" },
  categoryChipTextActive: { color: "#fff" },
  orderInput: { height: 46, borderWidth: 1, borderColor: "#d6dde8", borderRadius: 8, backgroundColor: "#fff", paddingHorizontal: 14, marginBottom: 8 },
  orderInputError: { borderColor: "#d93025", borderWidth: 2 },
  stepper: { minHeight: 48, borderWidth: 1, borderColor: "#d6dde8", borderRadius: 8, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", paddingHorizontal: 10, marginBottom: 8 },
  stepButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#e6f3ff", alignItems: "center", justifyContent: "center" },
  stepLabel: { flex: 1, color: "#1d8af0", fontSize: 16, marginLeft: 8 },
  stepValue: { width: 58, fontSize: 18, textAlign: "right" },
  totalRow: { minHeight: 60, backgroundColor: "#e9f4ff", borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginBottom: 18 },
  totalLabel: { flex: 1, color: "#1d8af0", fontSize: 16 },
  totalValue: { fontSize: 18, fontWeight: "800" },
  notEnoughPoints: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, backgroundColor: "#fdecec", padding: 12, marginTop: -6, marginBottom: 14 },
  notEnoughPointsText: { flex: 1, color: "#d93025", fontSize: 14, fontWeight: "800", lineHeight: 19 },
  doneButton: { height: 60, backgroundColor: "#050505", alignItems: "center", justifyContent: "center", borderRadius: 8, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  doneButtonText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  cancelButton: { height: 48, alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#777", fontWeight: "800" },
  warning: { color: "#777", lineHeight: 20, marginTop: 10 },
  playCategoryPanel: { width: "96%", maxWidth: 900, alignSelf: "center", marginTop: 8, marginBottom: 2, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1e6ef", paddingVertical: 7, paddingHorizontal: 8, shadowColor: "#172033", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  playCategoryTitle: { color: "#111318", fontSize: 13, fontWeight: "900", marginBottom: 6 },
  playCategoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  playCategoryChip: { minHeight: 30, borderRadius: 8, borderWidth: 1, borderColor: "#d6dde8", backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  playCategoryChipActive: { backgroundColor: "#1d8af0", borderColor: "#1d8af0" },
  playCategoryChipText: { color: "#5c6470", fontSize: 12, fontWeight: "900" },
  playCategoryChipTextActive: { color: "#fff" },
  player: { flex: 1, width: "96%", maxWidth: 900, alignSelf: "center", minHeight: 180, marginTop: 6, marginBottom: 6, padding: 10, borderRadius: 8, justifyContent: "space-between", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  adTvSet: { width: "96%", maxWidth: 900, alignSelf: "center", marginTop: 8, marginBottom: 8, alignItems: "center" },
  adAntennaRow: { position: "absolute", top: -6, zIndex: 2, width: 90, height: 30, flexDirection: "row", justifyContent: "center", gap: 24 },
  adAntenna: { width: 4, height: 34, borderRadius: 2, backgroundColor: "#232832", transform: [{ rotate: "-32deg" }] },
  adAntennaRight: { transform: [{ rotate: "32deg" }] },
  adTvScreen: { width: "100%", minHeight: 260, marginHorizontal: 0, marginTop: 16, marginBottom: 0, borderWidth: 10, borderColor: "#171b24", borderRadius: 18, backgroundColor: "#030405", shadowColor: "#050506", shadowOpacity: 0.34, shadowRadius: 22, shadowOffset: { width: 0, height: 14 } },
  adScreenGlow: { position: "absolute", top: 18, left: 18, right: 18, height: 86, borderRadius: 8, backgroundColor: "rgba(121,191,255,0.08)" },
  adOwnerBadge: { backgroundColor: "#222", borderColor: "#4a4a4a", paddingHorizontal: 12, paddingVertical: 7 },
  adMediaTitle: { fontSize: 22 },
  adPlayCircle: { shadowOpacity: 0.5, shadowRadius: 24 },
  adWatchCue: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  adListenText: { color: "#fff", fontSize: 14 },
  adTvNeck: { width: 70, height: 18, backgroundColor: "#171b24" },
  adTvBase: { width: 190, height: 14, borderRadius: 8, backgroundColor: "#171b24", shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  playerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mediaOwner: { color: "#fff", backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, maxWidth: "78%", fontWeight: "900" },
  shareButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  mediaTitle: { color: "#fff", fontSize: 20, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 8 },
  playerCategoryBadge: { alignSelf: "flex-start", color: "#fff", backgroundColor: "rgba(29,138,240,0.86)", borderRadius: 8, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 4, fontSize: 12, fontWeight: "900" },
  playCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#fff", alignSelf: "center", alignItems: "center", justifyContent: "center", shadowColor: "#fff", shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  embeddedPlayer: { width: "100%", height: 116, alignSelf: "center", backgroundColor: "#050505", borderRadius: 8, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  embeddedFallback: { width: "100%", height: 116, alignSelf: "center", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  embeddedFallbackText: { color: "#fff", fontWeight: "900", marginTop: 8 },
  listenText: { color: "#fff", alignSelf: "center", fontSize: 14, fontWeight: "800" },
  playControlsRow: { width: "96%", maxWidth: 900, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 0 },
  playLinkRow: { alignItems: "flex-end", marginHorizontal: 18, marginTop: 10 },
  playActionTab: { minWidth: 112, minHeight: 38, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "#d6dde8", backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  playActionTabText: { color: "#1d8af0", fontSize: 14, fontWeight: "900" },
  playActionTabDisabled: { backgroundColor: "#f0f3f7" },
  playActionTabDisabledText: { color: "#aeb5c0" },
  battleSplit: { flex: 1, width: "96%", maxWidth: 900, alignSelf: "center", flexDirection: "row", gap: 8, marginTop: 6, minHeight: 0, overflow: "hidden" },
  battlePane: { flex: 1, minHeight: 0, borderRadius: 8, backgroundColor: "#111318", borderWidth: 2, borderColor: "#232832", padding: 8, overflow: "hidden" },
  battlePaneActive: { borderColor: "#1d8af0", shadowColor: "#1d8af0", shadowOpacity: 0.32, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  battleSideLabel: { color: "#79bfff", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  battlePaneTitle: { minHeight: 30, color: "#fff", fontSize: 14, fontWeight: "900", marginTop: 3 },
  battleCategoryBadge: { alignSelf: "flex-start", color: "#fff", backgroundColor: "#1d8af0", borderRadius: 8, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontWeight: "900", marginTop: 4 },
  battlePlayerSlot: { flex: 1, minHeight: 76, borderRadius: 8, backgroundColor: "#050506", alignItems: "center", justifyContent: "center", overflow: "hidden", marginTop: 6 },
  battleThumb: { width: "100%", height: "100%", resizeMode: "cover" },
  battleLogoFill: { width: "100%", height: "100%", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  battleDefaultLogo: { width: "68%", height: "68%", resizeMode: "contain" },
  battleListenBadge: { minHeight: 28, borderRadius: 8, backgroundColor: "#232832", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 6 },
  battleListenBadgeDone: { backgroundColor: "#eaf8ef" },
  battleListenText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  battleListenTextDone: { color: "#148c45" },
  battleLinkButton: { minHeight: 32, borderRadius: 8, borderWidth: 1, borderColor: "#d6dde8", backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6 },
  battleLinkButtonDisabled: { backgroundColor: "#eef2f7", borderColor: "#eef2f7" },
  battleLinkText: { color: "#1d8af0", fontSize: 14, fontWeight: "900" },
  battleLinkTextDisabled: { color: "#9aa4b2" },
  battleStatus: { width: "96%", maxWidth: 900, alignSelf: "center", marginTop: 6, marginBottom: 0, padding: 9, borderRadius: 8, backgroundColor: "#fff", alignItems: "center", overflow: "hidden", shadowColor: "#172033", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  battleStatusText: { color: "#111318", fontSize: 16, fontWeight: "900", textAlign: "center" },
  battleStartButton: { minHeight: 42, borderRadius: 8, backgroundColor: "#1d8af0", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18, marginTop: 10, shadowColor: "#1d8af0", shadowOpacity: 0.24, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  battleStartText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  battleTimer: { color: "#e44e9b", fontSize: 34, fontWeight: "900", marginTop: 4 },
  battleTimerLabel: { color: "#777", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  battleVoteRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  battleVoteButton: { minWidth: 112, height: 44, borderRadius: 8, backgroundColor: "#1d8af0", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  battleVoteButtonActive: { backgroundColor: "#39cc70" },
  battleVoteText: { color: "#fff", fontSize: 17, fontWeight: "900" },
  autoplayRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", paddingVertical: 4, gap: 8 },
  autoplayText: { fontSize: 16, color: "#333" },
  buyText: { color: "#1d8af0", fontWeight: "800" },
  earnRow: { width: "96%", maxWidth: 900, alignSelf: "center", flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#fff", shadowColor: "#172033", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  metric: { width: 112, alignItems: "center" },
  metricValue: { fontSize: 28, fontWeight: "900", color: "#e44e9b" },
  metricLabel: { fontSize: 14, color: "#777", fontWeight: "700" },
  metricDivider: { height: 42, width: 1.5, backgroundColor: "#222" },
  skipButton: { width: "96%", maxWidth: 900, alignSelf: "center", marginTop: 6, marginBottom: 0, height: 44, backgroundColor: "#111318", borderRadius: 8, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  skipText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  formScreen: { flex: 1, width: "96%", maxWidth: 900, alignSelf: "center", backgroundColor: "#f6f8fb", padding: 24, alignItems: "center" },
  redeemScreen: { flex: 1, backgroundColor: "#f6f8fb" },
  redeemInner: { width: "96%", maxWidth: 900, alignSelf: "center", paddingTop: 10, paddingBottom: 68 },
  redeemHero: { borderRadius: 8, backgroundColor: "#0b0d12", padding: 10, alignItems: "center", shadowColor: "#172033", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  redeemTitle: { color: "#fff", fontSize: 19, fontWeight: "900", marginTop: 3 },
  redeemCopy: { color: "#cfd6e2", fontSize: 12, fontWeight: "700", lineHeight: 16, marginTop: 3, textAlign: "center" },
  redeemBalance: { minHeight: 34, borderRadius: 8, backgroundColor: "#171b24", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 10, marginTop: 7, flexWrap: "wrap" },
  redeemBalanceText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  redeemBadgeText: { color: "#cfd6e2", fontSize: 11, fontWeight: "900", textTransform: "capitalize" },
  redeemNoticeFloating: { position: "absolute", top: 12, left: 18, right: 18, zIndex: 4, shadowColor: "#172033", shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  redeemError: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 8, backgroundColor: "#fdecec", paddingVertical: 8, paddingHorizontal: 10 },
  redeemErrorText: { flex: 1, color: "#d93025", fontSize: 12, fontWeight: "800", lineHeight: 16 },
  redeemSuccess: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 8, backgroundColor: "#eaf8ef", paddingVertical: 8, paddingHorizontal: 10 },
  redeemSuccessText: { flex: 1, color: "#148c45", fontSize: 12, fontWeight: "900", lineHeight: 16 },
  giftGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  giftCard: { width: "48%", minHeight: 112, borderRadius: 8, backgroundColor: "#fff", padding: 9, alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#d6dde8", shadowColor: "#172033", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  giftCardDisabled: { opacity: 0.62 },
  giftIconWrap: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#e9f4ff", alignItems: "center", justifyContent: "center" },
  giftValue: { color: "#111318", fontSize: 22, fontWeight: "900", marginTop: 2 },
  giftCost: { color: "#777", fontSize: 11, fontWeight: "800", marginTop: 1 },
  giftButton: { minHeight: 31, borderRadius: 8, backgroundColor: "#1d8af0", alignItems: "center", justifyContent: "center", alignSelf: "stretch", marginTop: 5 },
  giftButtonDisabled: { backgroundColor: "#eef2f7" },
  giftButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  giftButtonTextDisabled: { color: "#7a818e" },
  redeemFootnote: { color: "#777", fontSize: 11, lineHeight: 15, textAlign: "center", marginTop: 8 },
  passCodeBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.58)", alignItems: "center", justifyContent: "center", padding: 18 },
  passCodeCard: { width: "100%", maxWidth: 360, borderRadius: 8, backgroundColor: "#fff", padding: 14, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  passCodeClose: { position: "absolute", top: 8, right: 8, width: 34, height: 34, borderRadius: 17, backgroundColor: "#eef2f7", alignItems: "center", justifyContent: "center" },
  passCodeTitle: { color: "#111318", fontSize: 20, fontWeight: "900", marginTop: 10 },
  passCodeCopy: { color: "#6f7581", fontSize: 13, fontWeight: "800", lineHeight: 18, textAlign: "center", marginTop: 4 },
  passCodeInput: { alignSelf: "stretch", height: 48, borderRadius: 8, borderWidth: 1, borderColor: "#d6dde8", backgroundColor: "#fff", color: "#111318", fontSize: 16, fontWeight: "900", paddingHorizontal: 12, marginTop: 12, textAlign: "center" },
  passCodeInputError: { borderColor: "#d93025", borderWidth: 2 },
  passCodeButton: { alignSelf: "stretch", minHeight: 46, borderRadius: 8, backgroundColor: "#1d8af0", alignItems: "center", justifyContent: "center", marginTop: 12, shadowColor: "#1d8af0", shadowOpacity: 0.24, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  passCodeButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  largeLabel: { marginTop: 120, fontWeight: "900", fontSize: 19, color: "#111318" },
  underlineInput: { width: "86%", height: 62, borderWidth: 1, borderColor: "#d6dde8", borderRadius: 8, backgroundColor: "#fff", textAlign: "center", fontSize: 18, marginVertical: 22 },
  inputError: { borderBottomColor: "#d93025" },
  errorText: { color: "#d93025", fontSize: 16, fontWeight: "800", marginTop: -12, marginBottom: 18, textAlign: "center" },
  primaryPill: { minWidth: 190, height: 52, borderRadius: 8, backgroundColor: "#1d8af0", alignItems: "center", justifyContent: "center", paddingHorizontal: 22, shadowColor: "#1d8af0", shadowOpacity: 0.24, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  primaryPillText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  inviteButtonRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  copyPill: { minWidth: 150, height: 52, borderRadius: 8, borderWidth: 1, borderColor: "#d6dde8", backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18 },
  copyPillText: { color: "#1d8af0", fontSize: 16, fontWeight: "900" },
  copyNotice: { minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 },
  copyNoticeText: { color: "#148c45", fontSize: 13, fontWeight: "800" },
  grayCenter: { color: "#777", fontSize: 15, marginTop: 22, textAlign: "center" },
  tipText: { color: "#777", fontSize: 15, lineHeight: 23, marginTop: 18, textAlign: "center" },
  inviteHeadline: { marginTop: 58, fontSize: 23, fontWeight: "900", lineHeight: 32, textAlign: "center", color: "#111318" },
  refLink: { color: "#1d8af0", fontSize: 18, fontWeight: "900", marginVertical: 22 },
  awardsScreen: { flex: 1, backgroundColor: "#080a0f" },
  awardsInner: { width: "96%", maxWidth: 900, alignSelf: "center", paddingTop: 14, paddingBottom: 24 },
  awardsHero: { borderRadius: 8, backgroundColor: "#10141d", borderWidth: 1, borderColor: "#222b39", padding: 14, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  awardsEyebrow: { color: "#79bfff", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  awardsTitle: { color: "#fff", fontSize: 26, fontWeight: "900", marginTop: 3 },
  awardsCopy: { color: "#c8d0dc", fontSize: 13, fontWeight: "800", lineHeight: 18, marginTop: 5 },
  awardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  awardCard: { width: "48%", minHeight: 230, borderRadius: 8, backgroundColor: "#11161f", borderWidth: 1, borderColor: "#2b3443", padding: 10, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  awardCardEarned: { borderColor: "#1d8af0", shadowColor: "#1d8af0", shadowOpacity: 0.18 },
  awardPlaqueStage: { width: "100%", height: 132, borderRadius: 8, backgroundColor: "#050505", borderWidth: 1, borderColor: "#2f3744", alignItems: "center", justifyContent: "center", marginBottom: 9, overflow: "hidden" },
  awardPlaqueStageLocked: { opacity: 0.72 },
  awardPlaqueImage: { width: "100%", height: "100%", resizeMode: "contain" },
  awardPlaqueImageLocked: { opacity: 0.66 },
  awardUnlockSlot: { width: "100%", height: "100%", borderRadius: 8, borderWidth: 2, borderStyle: "dashed", borderColor: "#465266", backgroundColor: "#151b25", alignItems: "center", justifyContent: "center" },
  awardTitle: { color: "#fff", fontSize: 15, fontWeight: "900", textAlign: "center" },
  awardMeta: { color: "#aeb7c5", fontSize: 12, fontWeight: "800", textAlign: "center", marginTop: 3 },
  awardStatus: { minHeight: 24, borderRadius: 8, backgroundColor: "#1b2330", paddingHorizontal: 10, alignItems: "center", justifyContent: "center", marginTop: 8 },
  awardStatusEarned: { backgroundColor: "#e8f8ef" },
  awardStatusText: { color: "#aeb7c5", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  awardStatusTextEarned: { color: "#148c45" },
  how: { flex: 1, backgroundColor: "#f6f8fb" },
  howInner: { width: "96%", maxWidth: 900, alignSelf: "center", paddingTop: 14, paddingBottom: 70 },
  infoBlock: { padding: 12, marginBottom: 10, borderRadius: 8, backgroundColor: "#fff", shadowColor: "#172033", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  infoTitle: { fontSize: 17, fontWeight: "900", marginBottom: 5 },
  infoCopy: { color: "#4d4d4d", lineHeight: 18, fontSize: 13 },
  badgeCopyWrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 },
  badgeCopyItem: { flexDirection: "row", alignItems: "center", gap: 5, marginRight: 1, marginBottom: 2 },
  badgeCopyFooter: { marginTop: 2 },
  leaderboardScreen: { flex: 1, backgroundColor: "#f6f8fb" },
  leaderboardHero: { width: "96%", maxWidth: 900, alignSelf: "center", marginTop: 12, marginBottom: 8, padding: 12, borderRadius: 8, backgroundColor: "#0b0d12", shadowColor: "#172033", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  leaderboardEyebrow: { color: "#79bfff", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  leaderboardTitle: { color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 2 },
  leaderboardToggle: { width: "96%", maxWidth: 900, alignSelf: "center", flexDirection: "row", gap: 8, marginBottom: 8 },
  leaderboardToggleButton: { flex: 1, minHeight: 38, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d6dde8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  leaderboardToggleActive: { backgroundColor: "#1d8af0", borderColor: "#1d8af0" },
  leaderboardToggleText: { color: "#1d8af0", fontSize: 13, fontWeight: "900" },
  leaderboardToggleTextActive: { color: "#fff" },
  leaderboardList: { width: "96%", maxWidth: 900, alignSelf: "center", paddingBottom: 86 },
  leaderboardRow: { minHeight: 56, borderRadius: 8, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 10, marginBottom: 8, shadowColor: "#172033", shadowOpacity: 0.05, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } },
  leaderRank: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#eef2f7", alignItems: "center", justifyContent: "center" },
  leaderRankTop: { backgroundColor: "#0b0d12", borderWidth: 1, borderColor: "#d8ad23" },
  leaderRankText: { color: "#7a818e", fontSize: 13, fontWeight: "900" },
  leaderRankTopText: { color: "#fff" },
  leaderAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#e9f4ff", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  leaderAvatarImage: { width: "100%", height: "100%", resizeMode: "cover" },
  leaderAvatarText: { color: "#1d8af0", fontSize: 16, fontWeight: "900" },
  leaderBody: { flex: 1 },
  leaderName: { color: "#111318", fontSize: 14, fontWeight: "900" },
  leaderSub: { color: "#7a818e", fontSize: 12, fontWeight: "800", marginTop: 1 },
  leaderCategoryRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 3, flexWrap: "wrap" },
  leaderCategoryBadge: { color: "#0b5cad", backgroundColor: "#e6f3ff", borderRadius: 8, overflow: "hidden", paddingHorizontal: 7, paddingVertical: 2, fontSize: 10, fontWeight: "900" },
  leaderLinkButton: { minWidth: 62, minHeight: 30, borderRadius: 8, borderWidth: 1, borderColor: "#d6dde8", backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 8 },
  leaderLinkButtonDisabled: { backgroundColor: "#f0f3f7" },
  leaderLinkText: { color: "#1d8af0", fontSize: 12, fontWeight: "900" },
  leaderLinkTextDisabled: { color: "#aeb5c0" },
  leaderActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  leaderBadge: { width: 32, alignItems: "center", justifyContent: "center" },
  bottomTabs: { height: 82, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e6eaf0", flexDirection: "row", shadowColor: "#172033", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: -4 } },
  bottomTab: { flex: 1, alignItems: "center", justifyContent: "center" },
  bottomIconMotion: { minHeight: 34, alignItems: "center", justifyContent: "center" },
  bottomBrandLogo: { width: 34, height: 34, resizeMode: "contain" },
  bottomLogoInactive: { opacity: 0.35 },
  bottomText: { color: "#aeb5c0", fontSize: 12, fontWeight: "800", marginTop: 2 },
  bottomTextActive: { color: "#1d8af0" },
  drawerBackdrop: { flex: 1, flexDirection: "row", backgroundColor: "rgba(0,0,0,0.58)" },
  drawerShade: { ...StyleSheet.absoluteFillObject },
  drawer: { width: "84%", maxWidth: 430, height: "100%", backgroundColor: "#fff", paddingTop: Platform.OS === "android" ? 30 : 20, paddingHorizontal: 18, borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  drawerScrollContent: { paddingBottom: 18 },
  profileHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  privacyInfoButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#111318", borderWidth: 1, borderColor: "#2f9bff", alignItems: "center", justifyContent: "center", marginTop: 2, shadowColor: "#1d8af0", shadowOpacity: 0.38, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  avatarWrap: { width: 78, marginBottom: 8 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#111318", borderWidth: 3, borderColor: "#e6f3ff", shadowColor: "#1d8af0", shadowRadius: 10, shadowOpacity: 0.26, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  avatarImage: { width: "100%", height: "100%", borderRadius: 36, resizeMode: "cover" },
  avatarEditBadge: { position: "absolute", right: 0, bottom: 5, width: 25, height: 25, borderRadius: 12.5, backgroundColor: "#1d8af0", borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 34 },
  profileName: { fontSize: 24, fontWeight: "900" },
  profileNameInput: { minWidth: 220, maxWidth: 300, minHeight: 38, borderRadius: 8, borderWidth: 1, borderColor: "#d6dde8", backgroundColor: "#fff", color: "#000", fontSize: 19, fontWeight: "900", paddingHorizontal: 10, paddingVertical: 4 },
  profileLinkInput: { minWidth: 220, maxWidth: 300, minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: "#d6dde8", backgroundColor: "#fff", color: "#111318", fontSize: 14, fontWeight: "800", paddingHorizontal: 10, paddingVertical: 5, marginTop: 8 },
  profileLinkInputError: { borderColor: "#d93025", backgroundColor: "#fff7f7" },
  profileLinkErrorRow: { maxWidth: 280, flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  profileLinkErrorText: { flex: 1, color: "#d93025", fontSize: 12, fontWeight: "800" },
  profileLinkReadyRow: { maxWidth: 280, flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  profileLinkReadyText: { flex: 1, color: "#148c45", fontSize: 12, fontWeight: "800" },
  profileEmail: { fontSize: 14, color: "#777", marginTop: 6 },
  drawerPoints: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f3f6fb", borderRadius: 8, padding: 11 },
  drawerLabel: { fontSize: 18, fontWeight: "900" },
  drawerSub: { color: "#777", marginTop: 2, fontSize: 13 },
  overallBubble: { minWidth: 62, height: 40, borderRadius: 8, backgroundColor: "#000", alignItems: "center", justifyContent: "center", paddingHorizontal: 11 },
  overallBubbleText: { color: "#fff", fontSize: 19, fontWeight: "900" },
  badgeLine: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 10 },
  drawerItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f0f2f5" },
  drawerItemText: { fontSize: 17, fontWeight: "900", color: "#111318" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.68)", alignItems: "center", justifyContent: "center", padding: 24 },
  privacyCard: { width: "100%", maxWidth: 430, maxHeight: "70%", borderRadius: 8, backgroundColor: "#fff", padding: 14, shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  privacyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  privacyTitle: { flex: 1, color: "#111318", fontSize: 18, fontWeight: "900", paddingRight: 10 },
  privacyClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#eef2f7", alignItems: "center", justifyContent: "center" },
  privacyBody: { maxHeight: 320 },
  privacyCopy: { color: "#4d4d4d", fontSize: 13, lineHeight: 19, marginBottom: 9 },
  autoplayCard: { width: "100%", maxWidth: 390, borderRadius: 8, backgroundColor: "#ecf8ff", padding: 16, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  modalLogo: { width: 84, height: 62, resizeMode: "contain", marginBottom: 2 },
  modalTitle: { fontSize: 24, fontWeight: "900", marginBottom: 10 },
  planRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  plan: { width: 126, minHeight: 104, borderWidth: 2, borderColor: "#111", borderRadius: 8, backgroundColor: "#79bfff", alignItems: "center", justifyContent: "center", padding: 8 },
  planDark: { borderColor: "#111" },
  planActive: { borderColor: "#1d8af0", shadowColor: "#1d8af0", shadowOpacity: 0.9, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, transform: [{ scale: 1.04 }] },
  planPrice: { fontSize: 22, fontWeight: "900", color: "#fff" },
  planText: { color: "#fff", marginTop: 3, textAlign: "center", fontSize: 13 },
  planDarkText: { color: "#111" },
  planCta: { color: "#0e62c4", fontWeight: "900", marginTop: 8, fontSize: 13 },
  plusPlan: { width: 160, minHeight: 104, borderRadius: 8, borderWidth: 2, borderColor: "#111", alignItems: "center", justifyContent: "center", padding: 8, backgroundColor: "#f6fbff" },
  plusPrice: { fontSize: 22, fontWeight: "900" },
  plusLabel: { color: "#777", textAlign: "center", marginTop: 4, fontSize: 13 },
  plusCta: { color: "#0e62c4", fontWeight: "900", marginTop: 8, fontSize: 13 },
  paypalModalNotice: { color: "#148c45", fontSize: 12, fontWeight: "900", textAlign: "center", marginTop: 10, lineHeight: 16 },
  paypalModalError: { color: "#d93025" },
  noThanks: { padding: 12 },
  noThanksText: { color: "#777", fontSize: 14 }
});
