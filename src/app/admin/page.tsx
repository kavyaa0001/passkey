"use client";

import { useEffect, useState, useRef } from "react";
import { Html5Qrcode, Html5QrcodeScanType } from "html5-qrcode";
import { X, Settings, CheckCircle2, XCircle, AlertCircle, Home as HomeIcon, Bell, Wallet, PlusSquare, LayoutTemplate, Camera, Search, Keyboard, LogOut, Users, PlusCircle } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, getDocs, addDoc, deleteDoc, where, setDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

type ScanState = "IDLE" | "VALID" | "INVALID" | "DUPLICATE";

// Mocking a database for scanned tickets
const mockScannedTickets = new Map<string, string>();
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

export default function AdminDashboard() {
  const [scanState, setScanState] = useState<ScanState>("IDLE");
  const [lastScannedId, setLastScannedId] = useState<string>("");
  const [scanMode, setScanMode] = useState<"in" | "out">("in");
  const [isScannerActive, setIsScannerActive] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannedUserData, setScannedUserData] = useState<{ 
    fullName: string; 
    photoURL: string | null; 
    email: string;
    eventName?: string;
    scannedAt?: string;
    declineReason?: string;
  } | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPhoto, setAdminPhoto] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  // Admin Notification Posting States
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [isPostingNotif, setIsPostingNotif] = useState(false);

  // Admin Stats State
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<{
    total: number;
    checkedIn: number;
    pending: number;
    reTickets: number;
    events: Record<string, { total: number; checkedIn: number; pending: number; reTickets: number }>;
  }>({ total: 0, checkedIn: 0, pending: 0, reTickets: 0, events: {} });

  // Preset Configurations for Themes & Images
  const PRESETS = [
    {
      name: "Sunset Glow",
      theme: "from-[#FFEFD5] to-[#FFE4B5]",
      bgTheme: "bg-[#6552D0]",
      textColor: "text-[#333333]",
      imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80"
    },
    {
      name: "Electric Indigo",
      theme: "from-blue-100 to-indigo-200",
      bgTheme: "bg-[#4F46E5]",
      textColor: "text-indigo-900",
      imageUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80"
    },
    {
      name: "Neon Rose",
      theme: "from-pink-100 to-rose-200",
      bgTheme: "bg-[#E11D48]",
      textColor: "text-rose-900",
      imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80"
    },
    {
      name: "Cyber Emerald",
      theme: "from-[#D1FAE5] to-[#A7F3D0]",
      bgTheme: "bg-[#059669]",
      textColor: "text-[#064E3B]",
      imageUrl: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&auto=format&fit=crop&q=80"
    },
    {
      name: "Volcanic Orange",
      theme: "from-[#FFEDD5] to-[#FED7AA]",
      bgTheme: "bg-[#EA580C]",
      textColor: "text-[#431407]",
      imageUrl: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&auto=format&fit=crop&q=80"
    }
  ];

  // Admin Add Event States
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [activeEventTab, setActiveEventTab] = useState<"list" | "add" | "edit">("list");
  const [adminEventsList, setAdminEventsList] = useState<any[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [evtTitle, setEvtTitle] = useState("");
  const [evtImage, setEvtImage] = useState("");
  const [evtDescription, setEvtDescription] = useState("");
  const [evtDate, setEvtDate] = useState("");
  const [evtStartTime, setEvtStartTime] = useState("");
  const [evtEndTime, setEvtEndTime] = useState("");
  const [evtVenuePill, setEvtVenuePill] = useState("");
  const [evtExtraFields, setEvtExtraFields] = useState("");
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  // Admin User List & History States
  const [showUsersList, setShowUsersList] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedUserHistory, setSelectedUserHistory] = useState<any | null>(null);
  const [showUserHistoryDetail, setShowUserHistoryDetail] = useState(false);

  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const fetchAdminEvents = async () => {
    if (!db) return;
    try {
      const q = query(collection(db, "events"));
      const querySnapshot = await getDocs(q);
      const list: any[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ docId: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => Number(b.id) - Number(a.id));
      setAdminEventsList(list);
    } catch (err) {
      console.error("Error fetching admin events:", err);
    }
  };

  const handleDeleteEvent = async (docId: string) => {
    if (!db) return;
    if (!confirm("Are you sure you want to delete this event and all associated tickets?")) return;
    try {
      const eventRef = doc(db, "events", docId);
      const eventSnap = await getDoc(eventRef);
      
      if (eventSnap.exists()) {
        const eventData = eventSnap.data();
        const eventName = eventData.title?.replace(/\n/g, ' ') || eventData.shortTitle || "";
        
        // Delete all tickets for this event
        if (eventName) {
          const ticketsQ = query(collection(db, "tickets"), where("eventName", "==", eventName));
          const ticketsSnap = await getDocs(ticketsQ);
          const deletePromises = ticketsSnap.docs.map(tDoc => deleteDoc(doc(db, "tickets", tDoc.id)));
          
          // Also try with shortTitle if they differ (just in case)
          if (eventData.shortTitle && eventData.shortTitle !== eventName) {
             const shortTicketsQ = query(collection(db, "tickets"), where("eventName", "==", eventData.shortTitle));
             const shortTicketsSnap = await getDocs(shortTicketsQ);
             shortTicketsSnap.docs.forEach(tDoc => deletePromises.push(deleteDoc(doc(db, "tickets", tDoc.id))));
          }
          await Promise.all(deletePromises);
        }
      }

      await deleteDoc(eventRef);
      await fetchAdminEvents();
    } catch (err) {
      console.error("Error deleting event and tickets:", err);
    }
  };

  const formatEventDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      
      const day = d.getDate();
      let suffix = "th";
      if (day === 1 || day === 21 || day === 31) suffix = "st";
      else if (day === 2 || day === 22) suffix = "nd";
      else if (day === 3 || day === 23) suffix = "rd";
      
      const month = d.toLocaleDateString("en-US", { month: "long" });
      const year = d.getFullYear();
      return `${month} ${day}${suffix}, ${year}`;
    } catch (e) {
      return dateStr;
    }
  };

  const formatEventTime = (timeStr: string) => {
    if (!timeStr) return "";
    try {
      const [hoursStr, minutesStr] = timeStr.split(":");
      const hours = parseInt(hoursStr, 10);
      const ampm = hours >= 12 ? "PM" : "AM";
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutesStr} ${ampm}`;
    } catch (e) {
      return timeStr;
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 600;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            setEvtImage(dataUrl);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !evtTitle.trim()) return;
    setIsSavingEvent(true);
    try {
      const preset = PRESETS[selectedPresetIndex];
      const eventId = `EVT-${Date.now()}`;
      
      const formattedDate = formatEventDate(evtDate);
      const formattedTimeRange = `${formatEventTime(evtStartTime)} - ${formatEventTime(evtEndTime)}`;
      const dateCombined = `${formattedDate}, ${formattedTimeRange}`;

      await setDoc(doc(db, "events", eventId), {
        id: Date.now(),
        title: evtTitle,
        shortTitle: evtTitle,
        subtitle: "",
        description: evtDescription,
        date: dateCombined,
        venuePill: evtVenuePill,
        theme: preset.theme,
        bgTheme: preset.bgTheme,
        textColor: preset.textColor,
        imageUrl: evtImage || preset.imageUrl || "",
        extraFields: evtExtraFields.split(',').map(f => f.trim()).filter(f => f)
      });

      // Automatically post a notification announcement for users
      await addDoc(collection(db, "notifications"), {
        title: `🎉 New Event: ${evtTitle}`,
        message: `We just published "${evtTitle.replace('\\n', ' ').replace('\n', ' ')}" happening on ${dateCombined} at ${evtVenuePill}. Register now!`,
        createdAt: serverTimestamp()
      });

      // Reset form
      setEvtTitle("");
      setEvtImage("");
      setEvtDescription("");
      setEvtDate("");
      setEvtStartTime("");
      setEvtEndTime("");
      setEvtVenuePill("");
      setEvtExtraFields("");
      setSelectedPresetIndex(0);
      setShowAddEvent(false);
      await fetchAdminEvents();
    } catch (err) {
      console.error("Error creating event:", err);
    }
    setIsSavingEvent(false);
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !editingEventId) return;
    setIsSavingEvent(true);
    try {
      const preset = PRESETS[selectedPresetIndex];
      
      const formattedDate = formatEventDate(evtDate);
      const formattedTimeRange = `${formatEventTime(evtStartTime)} - ${formatEventTime(evtEndTime)}`;
      const dateCombined = `${formattedDate}, ${formattedTimeRange}`;

      await updateDoc(doc(db, "events", editingEventId), {
        title: evtTitle,
        shortTitle: evtTitle,
        subtitle: "",
        description: evtDescription,
        date: dateCombined,
        venuePill: evtVenuePill,
        theme: preset.theme,
        bgTheme: preset.bgTheme,
        textColor: preset.textColor,
        imageUrl: evtImage || preset.imageUrl || "",
        extraFields: evtExtraFields.split(',').map(f => f.trim()).filter(f => f)
      });

      // Reset form
      setEvtTitle("");
      setEvtImage("");
      setEvtDescription("");
      setEvtDate("");
      setEvtStartTime("");
      setEvtEndTime("");
      setEvtVenuePill("");
      setEvtExtraFields("");
      setSelectedPresetIndex(0);
      setEditingEventId(null);
      setActiveEventTab("list");
      await fetchAdminEvents();
    } catch (err) {
      console.error("Error updating event:", err);
    }
    setIsSavingEvent(false);
  };

  const fetchUsersAndTickets = async () => {
    // Handled in real-time useEffect listener below
  };

  const fetchStats = async () => {
    // Handled in real-time useEffect listener below
  };

  // Real-time Tickets Stats and User List listener
  useEffect(() => {
    if (!db || isAuthLoading) return;

    const q = query(collection(db, "tickets"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ticketList: any[] = [];
      
      snapshot.forEach((docSnap) => {
        const ticketData = docSnap.data();
        ticketList.push({ docId: docSnap.id, ...ticketData });
      });

      // Sort tickets by bookedAt so earlier tickets come first
      ticketList.sort((a, b) => {
         const tA = a.bookedAt?.seconds || 0;
         const tB = b.bookedAt?.seconds || 0;
         return tA - tB;
      });

      let total = 0;
      let checkedIn = 0;
      let reTickets = 0;
      const eventStats: Record<string, { total: number; checkedIn: number; pending: number; reTickets: number }> = {};
      const userEventMap = new Map<string, boolean>();

      ticketList.forEach((ticketData) => {
        const eventName = ticketData.eventName || "Unknown Event";
        const emailKey = (ticketData.email || ticketData.userEmail || "").toLowerCase().trim();
        const userEventKey = `${emailKey}_${eventName}`;

        if (!eventStats[eventName]) {
          eventStats[eventName] = { total: 0, checkedIn: 0, pending: 0, reTickets: 0 };
        }

        const isCheckedIn = ticketData.status === "Used";

        if (emailKey && userEventMap.has(userEventKey)) {
          // Re-ticket
          reTickets++;
          eventStats[eventName].reTickets++;
        } else {
          // Unique ticket
          if (emailKey) {
            userEventMap.set(userEventKey, true);
          }
          total++;
          eventStats[eventName].total++;
          if (isCheckedIn) {
            checkedIn++;
            eventStats[eventName].checkedIn++;
          } else {
            eventStats[eventName].pending++;
          }
        }
      });
      
      // Update stats state
      setStats({ 
        total, 
        checkedIn, 
        pending: total - checkedIn, 
        reTickets,
        events: eventStats 
      });

      // Update usersList state group-by email
      const userMap = new Map<string, any>();
      ticketList.forEach((ticket) => {
        const emailKey = (ticket.email || ticket.userEmail || "").toLowerCase().trim();
        if (!emailKey) return;
        
        if (!userMap.has(emailKey)) {
          userMap.set(emailKey, {
            fullName: ticket.fullName || "Guest User",
            email: emailKey,
            phoneNumber: ticket.phoneNumber || "N/A",
            tickets: []
          });
        }
        userMap.get(emailKey).tickets.push(ticket);
      });
      
      // Sort users list by name
      const sortedUsers = Array.from(userMap.values()).sort((a, b) => 
        a.fullName.localeCompare(b.fullName)
      );
      setUsersList(sortedUsers);
      
      // Sync selectedUserHistory detail popup in real-time if open
      if (selectedUserHistory) {
        const updatedUser = sortedUsers.find(u => u.email === selectedUserHistory.email);
        if (updatedUser) {
          setSelectedUserHistory(updatedUser);
        }
      }
    }, (err) => {
      console.error("Error in real-time stats listener:", err);
    });

    return () => unsubscribe();
  }, [db, isAuthLoading, selectedUserHistory]);

  const fetchNotifications = async () => {
    if (!db) return;
    try {
      const q = query(collection(db, "notifications"));
      const querySnapshot = await getDocs(q);
      const list: any[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.userEmail) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setNotificationsList(list);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !notifTitle.trim() || !notifMessage.trim()) return;
    setIsPostingNotif(true);
    try {
      await addDoc(collection(db, "notifications"), {
        title: notifTitle,
        message: notifMessage,
        createdAt: serverTimestamp(),
        author: adminName || "Admin"
      });
      setNotifTitle("");
      setNotifMessage("");
      fetchNotifications();
    } catch (err) {
      console.error("Error posting announcement:", err);
    }
    setIsPostingNotif(false);
  };

  const handleDeleteNotification = async (id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "notifications", id));
      fetchNotifications();
    } catch (err) {
      console.error("Error deleting announcement:", err);
    }
  };

  // State for Admin Chance Requests
  const [chanceRequestsList, setChanceRequestsList] = useState<any[]>([]);

  // Effect to sync Chance Requests in real-time
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "chance_requests"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ docId: docSnap.id, ...docSnap.data() });
      });
      setChanceRequestsList(list);
    }, (err) => {
      console.error("Error listening to chance requests:", err);
    });
    return () => unsubscribe();
  }, [db]);

  const handleApproveChanceRequest = async (request: any) => {
    if (!db) return;
    try {
      // 1. Update request status to accepted
      await updateDoc(doc(db, "chance_requests", request.docId), {
        status: "accepted",
        resolvedAt: serverTimestamp()
      });

      // 2. Generate new ticket for the user
      const ticketId = `PK-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      await setDoc(doc(db, "tickets", ticketId), {
        ticketId,
        fullName: request.fullName,
        email: request.userEmail.toLowerCase().trim(),
        phoneNumber: request.phoneNumber || "",
        eventName: request.eventName,
        status: "Valid",
        bookedAt: serverTimestamp(),
        photoURL: request.photoURL || ""
      });

      // 3. Post a notification to the user
      await addDoc(collection(db, "notifications"), {
        title: `🎟️ Chance Request Approved: ${request.eventName}`,
        message: `Congratulations ${request.fullName}! Your request for an entry ticket to "${request.eventName}" has been accepted. Your new Ticket ID is ${ticketId}.`,
        userEmail: request.userEmail.toLowerCase().trim(),
        createdAt: serverTimestamp()
      });

      alert(`Approved! New ticket (${ticketId}) generated for ${request.fullName}.`);
    } catch (err) {
      console.error("Error approving chance request:", err);
      alert("Failed to approve chance request.");
    }
  };

  const handleDeclineChanceRequest = async (request: any) => {
    if (!db) return;
    try {
      // 1. Update request status to rejected
      await updateDoc(doc(db, "chance_requests", request.docId), {
        status: "rejected",
        resolvedAt: serverTimestamp()
      });

      // 2. Post a notification to the user
      await addDoc(collection(db, "notifications"), {
        title: `❌ Chance Request Declined`,
        message: `Your request for a ticket to "${request.eventName}" could not be approved at this time.`,
        userEmail: request.userEmail.toLowerCase().trim(),
        createdAt: serverTimestamp()
      });

      alert(`Declined request from ${request.fullName}.`);
    } catch (err) {
      console.error("Error declining chance request:", err);
      alert("Failed to decline chance request.");
    }
  };

  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
      } else if (ADMIN_EMAIL && user.email !== ADMIN_EMAIL) {
        // Not admin → send to user home
        router.push("/home");
      } else {
        setAdminEmail(user.email || "");
        setAdminName(user.displayName || user.email?.split("@")[0] || "Admin");
        setAdminPhoto(user.photoURL || null);
        fetchNotifications();
        fetchStats();
        fetchAdminEvents();
        setIsAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (isAuthLoading || !isScannerActive || scanState !== "IDLE") return;

    // Check if DOM container "qr-reader" exists
    const container = document.getElementById("qr-reader");
    if (!container) return;

    try {
      if (typeof window !== "undefined" && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
        setScannerError("Camera access is blocked because you are using an insecure connection (HTTP). Please access via the HTTPS URL or enter the ticket code manually below.");
        return;
      }

      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;

      html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          onScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Keep parsing frames silently
        }
      ).then(() => {
        setScannerError(null);
      }).catch((err) => {
        console.error("Camera start failed:", err);
        setScannerError("Camera permission denied, or camera is currently in use by another app.");
      });

    } catch (err: any) {
      console.error("Scanner failed to initialize:", err);
      setScannerError("Unable to access camera. Please verify camera permissions are allowed, or enter the ticket code manually.");
    }

    return () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(console.error);
          }
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, [isScannerActive, scanState, isAuthLoading]);

  const onScanSuccess = async (decodedText: string) => {
    if (scanState !== "IDLE") return;
    
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(console.error);
        }
      } catch (e) {
        console.error(e);
      }
    }

    setLastScannedId(decodedText);
    const now = new Date();

    if (db) {
      try {
        const ticketRef = doc(db, "tickets", decodedText);
        const ticketSnap = await getDoc(ticketRef);
        
        if (!ticketSnap.exists()) {
          setScanState("INVALID");
          setScannedUserData(null);
          return;
        }
        
        const data = ticketSnap.data();
        let timeStr = "";
        if (data.scannedAt && typeof data.scannedAt.toDate === "function") {
          timeStr = data.scannedAt.toDate().toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
          });
        }

        setScannedUserData({
          fullName: data.fullName || data.userName || "Guest User",
          photoURL: data.photoURL || data.userPhoto || null,
          email: data.email || data.userEmail || "",
          eventName: data.eventName || "",
          declineReason: data.status === "Used" 
            ? `Ticket was already checked-in${timeStr ? ' at ' + timeStr : ''}.` 
            : data.status ? `Ticket status is ${data.status}.` : "Ticket is invalid."
        });

        const userEmailTarget = (data.email || data.userEmail || "").toLowerCase().trim();
        if (data.status === "Used") {
          setScanState("DUPLICATE");
          await addDoc(collection(db, "notifications"), {
            title: `❌ Entry Declined: ${data.eventName || "Event"}`,
            message: `Hi ${data.fullName || "Guest"}, entry for ticket (${decodedText}) was declined. Reason: Already checked-in / Duplicate scan.`,
            userEmail: userEmailTarget,
            createdAt: serverTimestamp()
          });
        } else {
          await updateDoc(ticketRef, {
            status: "Used",
            scannedAt: serverTimestamp()
          });
          setScanState("VALID");
          await addDoc(collection(db, "notifications"), {
            title: `✅ Ticket Approved: ${data.eventName || "Event"}`,
            message: `Hi ${data.fullName || "Guest"}, your ticket (${decodedText}) has been approved and checked in successfully! Enjoy the event.`,
            userEmail: userEmailTarget,
            createdAt: serverTimestamp()
          });
        }
      } catch (error) {
        console.error("Error verifying ticket:", error);
        setScanState("INVALID");
        setScannedUserData(null);
      }
    } else {
      // Mock logic if Firebase isn't configured
      if (!decodedText.startsWith("PK-")) {
        setScanState("INVALID");
        setScannedUserData(null);
      } else if (mockScannedTickets.has(decodedText)) {
        setScanState("DUPLICATE");
        setScannedUserData({
          fullName: "Alexander Yoke",
          photoURL: "https://i.pravatar.cc/100?img=11",
          email: "alexander@yoke.com"
        });
      } else {
        mockScannedTickets.set(decodedText, now.toLocaleTimeString());
        setScanState("VALID");
        setScannedUserData({
          fullName: "Alexander Yoke",
          photoURL: "https://i.pravatar.cc/100?img=11",
          email: "alexander@yoke.com"
        });
      }
    }
  };

  const onScanFailure = (error: any) => {};

  const handleReset = () => {
    setScanState("IDLE");
    setLastScannedId("");
    setShowManualInput(false);
    setManualCode("");
    setScannedUserData(null);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScanSuccess(manualCode.trim().toUpperCase());
      setShowManualInput(false);
      setManualCode("");
    }
  };

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push("/admin/login");
    }
  };

  if (isAuthLoading) {
    return (
      <div className="w-full h-[100dvh] flex items-center justify-center bg-[#111115]">
        <div className="w-8 h-8 border-4 border-[#8D55F3]/30 border-t-[#8D55F3] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[100dvh] bg-[#111115] text-white flex flex-col overflow-hidden font-sans">
      
      {/* Scanner Viewport */}
      <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
         {scannerError ? (
           <div className="w-full h-full bg-[#1C1C22] flex items-center justify-center flex-col p-6 text-center text-white/70 max-w-[360px] mx-auto gap-4">
             <div className="w-14 h-14 rounded-full bg-[#FF9500]/10 flex items-center justify-center">
               <AlertCircle className="w-8 h-8 text-[#FF9500]" />
             </div>
             <h3 className="text-white font-bold text-lg">Camera Access Blocked</h3>
             <p className="text-white/50 text-xs leading-relaxed">
               {scannerError}
             </p>
             <button
               onClick={() => {
                 setShowManualInput(true);
               }}
               className="mt-2 bg-[#8D55F3] text-white font-bold text-sm px-6 py-2.5 rounded-full hover:bg-[#A57CF4] transition-colors shadow-lg active:scale-95"
             >
               Use Manual Input
             </button>
           </div>
         ) : scanState === "IDLE" ? (
           <div id="qr-reader" className="w-full h-full [&_video]:object-cover [&_video]:h-full" />
         ) : (
           <div className="w-full h-full bg-[#1C1C22] flex items-center justify-center flex-col gap-4 text-white/50">
             <Camera className="w-12 h-12" />
             <p>Camera paused</p>
           </div>
         )}
      </div>

      {/* Top Controls Area */}
      <div className="relative z-10 w-full pt-14 px-5 flex flex-col items-center gap-4">
        
        {/* Verification Title Header */}
        <div className="bg-[#1C1C22]/80 backdrop-blur-xl rounded-full px-6 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/5 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#34C759] animate-pulse"></div>
          <span className="text-sm font-bold tracking-wide uppercase text-white/90">Check-In Active</span>
        </div>

        {/* Manual Input Bar */}
        {scanState === "IDLE" && (
          <div className="w-full max-w-[320px] animate-in slide-in-from-top-4 fade-in duration-300">
            {showManualInput ? (
              <form onSubmit={handleManualSubmit} className="relative flex items-center shadow-2xl">
                <div className="absolute left-4 text-white/40">
                  <Search className="w-5 h-5" />
                </div>
                <input
                  autoFocus
                  type="text"
                  placeholder="Enter PK-XXXXXX"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full bg-[#1C1C22]/90 backdrop-blur-xl border border-[#8D55F3]/50 rounded-full pl-12 pr-12 py-3.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#8D55F3]/50 shadow-inner"
                />
                <button type="button" onClick={() => setShowManualInput(false)} className="absolute right-4 text-white/40 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </form>
            ) : (
              <button 
                onClick={() => setShowManualInput(true)}
                className="w-full bg-[#1C1C22]/60 backdrop-blur-md border border-white/10 rounded-full px-5 py-3 flex items-center justify-center gap-2 text-white/70 hover:bg-white/10 transition-colors shadow-lg"
              >
                <Keyboard className="w-5 h-5" />
                <span className="text-sm font-medium">Enter Code Manually</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* OVERLAY BOTTOM SHEET MODALS FOR SCAN RESULTS */}
      {scanState !== "IDLE" && (
        <>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[60] animate-in fade-in" onClick={handleReset} />
          <div className="absolute bottom-0 left-0 w-full z-[70] animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#1C1C22] rounded-t-[2.5rem] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.6)] border-t border-white/5 pb-12">
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6"></div>
              
              {/* User Header */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  {scannedUserData?.photoURL ? (
                    <img src={scannedUserData.photoURL} alt="Avatar" className="w-12 h-12 rounded-full border border-white/10 object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#8D55F3] to-[#6552D0] flex items-center justify-center font-bold text-white text-lg border border-white/10 shrink-0">
                      {(scannedUserData?.fullName || "G")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-lg leading-tight text-white">{scannedUserData?.fullName || "Guest User"}</h3>
                    <p className="text-[10px] text-[#8D55F3] font-mono font-bold mt-0.5 uppercase tracking-wide">ID: {lastScannedId}</p>
                  </div>
                </div>
                <div className="flex gap-2 text-white/50">
                  <button onClick={handleReset} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10"><X className="w-4 h-4" /></button>
                  <button onClick={handleLogout} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#FF4444]/20 hover:text-[#FF4444] transition-colors"><LogOut className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-3 mb-8">
                <div className="bg-[#2A2A35] rounded-2xl px-4 py-3.5 border border-white/5">
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Event Name</p>
                  <p className="text-sm font-medium truncate">{scannedUserData?.eventName || "Standard Entry"}</p>
                </div>
                <div className="bg-[#2A2A35] rounded-2xl px-4 py-3.5 border border-white/5">
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Email Address</p>
                  <p className="text-sm font-medium truncate">{scannedUserData?.email || "N/A"}</p>
                </div>
                <div className="flex justify-between items-center bg-[#2A2A35] rounded-2xl px-4 py-3.5 border border-white/5">
                  <div>
                    <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Verification Status</p>
                    <p className="text-sm font-medium">
                      {scanState === "VALID" ? "Checked-In" : scanState === "DUPLICATE" ? "Duplicate Scan" : "Rejected"}
                    </p>
                  </div>
                  
                  {/* Status Pill inline */}
                  {scanState === "VALID" && <span className="bg-[#34C759]/20 text-[#34C759] text-xs font-bold px-3 py-1.5 rounded-full border border-[#34C759]/30">Going</span>}
                  {scanState === "DUPLICATE" && <span className="bg-[#FF9500]/20 text-[#FF9500] text-xs font-bold px-3 py-1.5 rounded-full border border-[#FF9500]/30">Declined</span>}
                  {scanState === "INVALID" && <span className="bg-[#FF4444]/20 text-[#FF4444] text-xs font-bold px-3 py-1.5 rounded-full border border-[#FF4444]/30">Error</span>}
                </div>
              </div>

              {/* BIG RESULT ACTION */}
              <div className="flex flex-col items-center w-full">
                {scanState === "VALID" && (
                  <button onClick={handleReset} className="w-full bg-[#34C759] text-black font-bold text-lg py-4 rounded-[1.25rem] flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-[0_10px_20px_rgba(52,199,89,0.3)]">
                    Approved <CheckCircle2 className="w-6 h-6" />
                  </button>
                )}
                
                {scanState === "DUPLICATE" && (
                  <div className="w-full text-center">
                    <button onClick={handleReset} className="w-full bg-[#FF9500] text-black font-bold text-lg py-4 rounded-[1.25rem] flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-[0_10px_20px_rgba(255,149,0,0.3)] mb-4">
                      Declined <XCircle className="w-6 h-6" />
                    </button>
                    <div className="bg-[#FF9500]/10 border border-[#FF9500]/25 rounded-2xl p-4 text-left">
                      <p className="text-[10px] text-[#FF9500] font-black uppercase tracking-wider mb-1">Decline Reason</p>
                      <p className="text-xs text-white/80 leading-relaxed font-semibold">
                        {scannedUserData?.declineReason || "This pass was already scanned and checked-in."}
                      </p>
                    </div>
                  </div>
                )}

                {scanState === "INVALID" && (
                  <div className="w-full text-center">
                    <div className="w-16 h-16 rounded-full bg-[#FF4444]/10 flex items-center justify-center mx-auto mb-4">
                      <XCircle className="w-8 h-8 text-[#FF4444]" />
                    </div>
                    <h2 className="text-[#FF4444] font-bold text-2xl mb-2">Not Valid</h2>
                    <p className="text-white/50 text-sm mb-8">Warning! This QR Code is Not Valid</p>
                    <button onClick={handleReset} className="w-full bg-[#8D55F3] text-white font-bold text-lg py-4 rounded-[1.25rem] hover:opacity-90 transition-opacity shadow-lg">
                      Done
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* GLOBAL BOTTOM NAVIGATION - FLOATING GLASS */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-[360px] z-50">
        <div className="bg-[#2A2A35]/80 backdrop-blur-xl border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.5)] rounded-full px-4.5 py-2.5 flex items-center justify-between">
          {/* Home / Scan Button */}
          <button 
            onClick={() => {
              handleReset();
              setShowProfile(false);
              setShowNotifications(false);
              setShowStats(false);
              setShowAddEvent(false);
              setShowUsersList(false);
            }}
            className={`${(!showProfile && !showNotifications && !showStats && !showAddEvent && !showUsersList && scanState === "IDLE") ? "text-[#8D55F3]" : "text-white/40 hover:text-white"} transition-colors relative flex items-center justify-center p-1.5`}
            title="Scan Passes"
          >
            <HomeIcon className="w-5 h-5" />
          </button>

          {/* Add Event Button */}
          <button 
            onClick={() => {
              fetchAdminEvents();
              setActiveEventTab("list");
              setShowAddEvent(true);
              setShowProfile(false);
              setShowNotifications(false);
              setShowStats(false);
              setShowUsersList(false);
            }}
            className={`${showAddEvent ? "text-[#8D55F3]" : "text-white/40 hover:text-white"} transition-colors relative flex items-center justify-center p-1.5`}
            title="Add Event"
          >
            <PlusCircle className="w-5 h-5" />
          </button>

          {/* Users List Button */}
          <button 
            onClick={() => {
              fetchUsersAndTickets();
              setShowUsersList(true);
              setShowAddEvent(false);
              setShowProfile(false);
              setShowNotifications(false);
              setShowStats(false);
            }}
            className={`${showUsersList ? "text-[#8D55F3]" : "text-white/40 hover:text-white"} transition-colors relative flex items-center justify-center p-1.5`}
            title="User History"
          >
            <Users className="w-5 h-5" />
          </button>

          {/* Notifications Button */}
          <button 
            onClick={() => {
              fetchNotifications();
              setShowNotifications(true);
              setShowAddEvent(false);
              setShowProfile(false);
              setShowStats(false);
              setShowUsersList(false);
            }}
            className={`${showNotifications ? "text-[#8D55F3]" : "text-white/40 hover:text-white"} transition-colors relative flex items-center justify-center p-1.5`}
            title="Announce"
          >
            <Bell className="w-5 h-5" />
          </button>

          {/* Stats Wallet Button */}
          <button 
            onClick={() => {
              fetchStats();
              setShowStats(true);
              setShowAddEvent(false);
              setShowProfile(false);
              setShowNotifications(false);
              setShowUsersList(false);
            }}
            className={`${showStats ? "text-[#8D55F3]" : "text-white/40 hover:text-white"} transition-colors relative flex items-center justify-center p-1.5`}
            title="Stats"
          >
            <Wallet className="w-5 h-5" />
          </button>

          {/* Profile Button */}
          <button 
            onClick={() => {
              setShowProfile(true);
              setShowAddEvent(false);
              setShowNotifications(false);
              setShowStats(false);
              setShowUsersList(false);
            }}
            className={`${showProfile ? "text-[#8D55F3] border-[#8D55F3]" : "text-white/40 border-white/10 hover:text-white"} transition-all w-8 h-8 rounded-full flex items-center justify-center border overflow-hidden`} 
            title="Profile"
          >
            {adminPhoto && !photoError ? (
              <img 
                src={adminPhoto} 
                alt="profile" 
                className="w-full h-full object-cover" 
                onError={() => setPhotoError(true)}
              />
            ) : (
              <div className="w-full h-full bg-white/10 flex items-center justify-center font-bold text-xs text-white uppercase">
                {adminName.charAt(0)}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* ADMIN PROFILE BOTTOM SHEET */}
      {showProfile && (
        <>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[60] animate-in fade-in" onClick={() => setShowProfile(false)} />
          <div className="absolute bottom-0 left-0 w-full z-[70] animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#1C1C22] rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5 max-h-[85vh] flex flex-col">
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 shrink-0"></div>
              
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-bold">Admin Portal</h3>
                <button onClick={() => setShowProfile(false)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Profile Image & email */}
              <div className="flex flex-col items-center text-center mb-8 shrink-0">
                <div className="relative mb-3">
                  {adminPhoto ? (
                    <img src={adminPhoto} alt="profile" className="w-20 h-20 rounded-full border-2 border-[#8D55F3] object-cover shadow-lg" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-[#8D55F3]/20 border-2 border-[#8D55F3] flex items-center justify-center text-2xl font-bold text-[#A57CF4] uppercase">
                      {adminName.charAt(0)}
                    </div>
                  )}
                </div>
                <h4 className="text-lg font-bold">{adminName} <span className="text-xs font-bold text-[#8D55F3] bg-[#8D55F3]/10 px-2 py-0.5 rounded-md border border-[#8D55F3]/20">ADMIN</span></h4>
                <p className="text-white/40 text-xs mt-1">{adminEmail}</p>
              </div>

              <h5 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3 ml-1 shrink-0">Security Status</h5>
              
              <div className="bg-[#2A2A35]/50 border border-white/5 rounded-2xl p-4 mb-8 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Database Access</span>
                  <span className="text-[#34C759] font-semibold">Atomic Connected</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Scanning Mode</span>
                  <span className="text-[#8D55F3] font-semibold">Admin Validator</span>
                </div>
              </div>

              {/* Sign out button */}
              <button
                onClick={handleLogout}
                className="w-full bg-[#FF4444]/10 hover:bg-[#FF4444]/20 text-[#FF4444] border border-[#FF4444]/20 font-bold py-4 rounded-[1.25rem] flex items-center justify-center gap-2 transition-colors shrink-0"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ADMIN NOTIFICATION ANNOUNCEMENT SHEET */}
      {showNotifications && (
        <>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[60] animate-in fade-in" onClick={() => setShowNotifications(false)} />
          <div className="absolute bottom-0 left-0 w-full z-[70] animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#1C1C22] rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5 max-h-[85vh] flex flex-col">
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 shrink-0"></div>
              
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-bold">Post Announcement</h3>
                <button onClick={() => setShowNotifications(false)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form to Post Announcement */}
              <form onSubmit={handlePostNotification} className="space-y-4 mb-6 shrink-0">
                <div>
                  <input 
                    required 
                    type="text" 
                    placeholder="Announcement Title" 
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    className="bg-[#2A2A35] rounded-xl px-4 py-3 w-full text-white placeholder-white/40 border border-white/5 focus:outline-none focus:border-[#8D55F3] transition-colors text-sm"
                  />
                </div>
                <div>
                  <textarea 
                    required 
                    placeholder="Type your message to users..." 
                    value={notifMessage}
                    onChange={(e) => setNotifMessage(e.target.value)}
                    rows={2}
                    className="bg-[#2A2A35] rounded-xl px-4 py-3 w-full text-white placeholder-white/40 border border-white/5 focus:outline-none focus:border-[#8D55F3] transition-colors text-sm resize-none"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isPostingNotif}
                  className="w-full bg-[#8D55F3] text-white font-bold py-3 rounded-xl flex justify-center shadow-lg hover:opacity-90 transition-opacity text-sm"
                >
                  {isPostingNotif ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Post to Users"}
                </button>
              </form>

              <h5 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3 ml-1 shrink-0">Previously Sent Announcements</h5>

              {/* List of Sent Announcements */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[150px] max-h-[25vh] hide-scrollbar">
                {notificationsList.length === 0 ? (
                  <div className="bg-[#2A2A35]/30 border border-white/5 rounded-2xl p-6 text-center text-white/40 text-xs">
                    No announcements posted yet.
                  </div>
                ) : (
                  notificationsList.map((notif) => (
                    <div key={notif.id} className="bg-[#2A2A35]/50 border border-white/5 rounded-2xl p-4 flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-4">
                        <h6 className="font-bold text-sm text-[#A57CF4]">{notif.title}</h6>
                        <p className="text-xs text-white/60 mt-1 leading-relaxed">{notif.message}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteNotification(notif.id)}
                        className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase py-1 px-2.5 rounded-lg bg-red-500/10 border border-red-500/20 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ADMIN STATS DASHBOARD SHEET */}
      {showStats && (
        <>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[60] animate-in fade-in" onClick={() => setShowStats(false)} />
          <div className="absolute bottom-0 left-0 w-full z-[70] animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#1C1C22] rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 shrink-0"></div>
              
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-bold">Registration Stats</h3>
                <button onClick={() => setShowStats(false)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Overall Stats Cards Grid */}
              <div className="grid grid-cols-4 gap-3 mb-6 shrink-0">
                <div className="bg-[#2A2A35]/50 border border-white/5 rounded-2xl p-3 text-center">
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Total</p>
                  <p className="text-xl font-black text-white">{stats.total}</p>
                </div>
                <div className="bg-[#34C759]/10 border border-[#34C759]/20 rounded-2xl p-3 text-center">
                  <p className="text-[10px] text-[#34C759] uppercase font-bold mb-1">Checked In</p>
                  <p className="text-xl font-black text-[#34C759]">{stats.checkedIn}</p>
                </div>
                <div className="bg-[#FF9500]/10 border border-[#FF9500]/20 rounded-2xl p-3 text-center">
                  <p className="text-[10px] text-[#FF9500] uppercase font-bold mb-1">Pending</p>
                  <p className="text-xl font-black text-[#FF9500]">{stats.pending}</p>
                </div>
                <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-2xl p-3 text-center">
                  <p className="text-[10px] text-[#FF3B30] uppercase font-bold mb-1">Re-Tickets</p>
                  <p className="text-xl font-black text-[#FF3B30]">{stats.reTickets}</p>
                </div>
              </div>

              {/* Event Wise Stats */}
              <div className="flex-1 overflow-y-auto hide-scrollbar mb-6 min-h-[150px]">
                <h4 className="text-sm font-bold text-white/70 mb-3 uppercase tracking-wider">Event Breakdown</h4>
                <div className="space-y-3">
                  {Object.entries(stats.events).length === 0 ? (
                    <div className="text-white/40 text-xs text-center py-4 bg-[#2A2A35]/30 rounded-xl border border-white/5">
                      No events data available
                    </div>
                  ) : (
                    Object.entries(stats.events).map(([eventName, eventStat]) => (
                      <div key={eventName} className="bg-[#2A2A35]/50 border border-white/5 rounded-2xl p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h5 className="font-bold text-sm text-white truncate pr-2">{eventName}</h5>
                          <span className="text-[10px] font-bold px-2 py-1 bg-white/10 rounded-md text-white/70">
                            {eventStat.total > 0 ? Math.round((eventStat.checkedIn / eventStat.total) * 100) : 0}% Check-in
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex flex-col">
                            <span className="text-white/40 text-[10px] uppercase">Total</span>
                            <span className="font-bold">{eventStat.total}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[#34C759]/70 text-[10px] uppercase">In</span>
                            <span className="font-bold text-[#34C759]">{eventStat.checkedIn}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[#FF9500]/70 text-[10px] uppercase">Wait</span>
                            <span className="font-bold text-[#FF9500]">{eventStat.pending}</span>
                          </div>
                          <div className="flex flex-col ml-auto text-right">
                            <span className="text-[#FF3B30]/70 text-[10px] uppercase">Re-Tickets</span>
                            <span className="font-bold text-[#FF3B30]">{eventStat.reTickets}</span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-3">
                          <div 
                            className="h-full bg-gradient-to-r from-[#8D55F3] to-[#34C759] transition-all duration-500" 
                            style={{ width: `${eventStat.total > 0 ? (eventStat.checkedIn / eventStat.total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button 
                onClick={() => setShowStats(false)} 
                className="w-full bg-[#8D55F3] text-white font-bold py-4 rounded-[1.25rem] shadow-lg hover:opacity-90 transition-opacity"
              >
                Close Dashboard
              </button>
            </div>
          </div>
        </>
      )}

      {/* ADMIN EVENTS MANAGER (LIST & CREATE/EDIT) */}
      {showAddEvent && (
        <>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[60] animate-in fade-in" onClick={() => setShowAddEvent(false)} />
          <div className="absolute bottom-0 left-0 w-full z-[70] animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#1C1C22] rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5 max-h-[90vh] flex flex-col">
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 shrink-0"></div>
              
              <div className="flex justify-between items-center mb-5 shrink-0">
                <h3 className="text-xl font-bold">Manage Events</h3>
                <button onClick={() => setShowAddEvent(false)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tab Selector */}
              <div className="flex gap-2 mb-5 shrink-0 bg-[#2A2A35]/30 p-1 rounded-xl border border-white/5">
                <button 
                  type="button" 
                  onClick={() => {
                    setActiveEventTab("list");
                    setEditingEventId(null);
                  }} 
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${activeEventTab === "list" ? "bg-[#8D55F3] text-white" : "text-white/40 hover:text-white"}`}
                >
                  Active Events ({adminEventsList.length})
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setEvtTitle("");
                    setEvtImage("");
                    setEvtDate("");
                    setEvtStartTime("");
                    setEvtEndTime("");
                    setEvtVenuePill("");
                    setEvtExtraFields("");
                    setSelectedPresetIndex(0);
                    setEditingEventId(null);
                    setActiveEventTab("add");
                  }} 
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${(activeEventTab === "add" || activeEventTab === "edit") ? "bg-[#8D55F3] text-white" : "text-white/40 hover:text-white"}`}
                >
                  {activeEventTab === "edit" ? "Edit Event" : "Create Event"}
                </button>
              </div>

              {/* PANEL 1: EVENTS LIST */}
              {activeEventTab === "list" && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[250px] max-h-[55vh] hide-scrollbar mb-4">
                  {adminEventsList.length === 0 ? (
                    <div className="bg-[#2A2A35]/30 border border-white/5 rounded-2xl p-8 text-center text-white/40 text-sm">
                      No events found. Click "Create Event" to add one!
                    </div>
                  ) : (
                    adminEventsList.map((evt) => (
                      <div 
                        key={evt.docId || evt.id} 
                        className="bg-[#2A2A35]/50 border border-white/5 rounded-2xl p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-4">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${evt.theme || "from-[#FFEFD5] to-[#FFE4B5]"} flex items-center justify-center font-bold text-white uppercase text-xs shrink-0 shadow-md`}>
                            {evt.shortTitle?.charAt(0) || "E"}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm truncate text-white">{evt.shortTitle}</h4>
                            <p className="text-xs text-white/40 truncate mt-0.5">{evt.date}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button 
                            onClick={() => {
                              setEditingEventId(evt.docId || `EVT-${evt.id}`);
                              setEvtTitle(evt.title || "");
                              setEvtImage(evt.imageUrl || "");
                              setEvtVenuePill(evt.venuePill || "");
                              setEvtExtraFields(evt.extraFields ? evt.extraFields.join(", ") : "");
                              setEvtDescription(evt.description || "");
                              
                              const parseToDateInput = (str: string) => {
                                try {
                                  const datePart = str.split(",")[0].trim();
                                  const d = new Date(datePart);
                                  if (!isNaN(d.getTime())) {
                                    return d.toISOString().split("T")[0];
                                  }
                                } catch (e) {}
                                return new Date().toISOString().split("T")[0];
                              };

                              const parseToTimeInput = (str: string) => {
                                try {
                                  const match = str.match(/(\d+)(?::(\d+))?\s*(AM|PM)/i);
                                  if (match) {
                                    let hours = parseInt(match[1], 10);
                                    const minutes = match[2] ? parseInt(match[2], 10) : 0;
                                    const ampm = match[3].toUpperCase();
                                    if (ampm === "PM" && hours < 12) hours += 12;
                                    if (ampm === "AM" && hours === 12) hours = 0;
                                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                                  }
                                } catch (e) {}
                                return "12:00";
                              };

                              const dateParts = (evt.date || "").split(", ");
                              let dateStr = "";
                              let timeStartStr = "";
                              let timeEndStr = "";
                              if (dateParts.length >= 3) {
                                dateStr = dateParts[0] + ", " + dateParts[1];
                                const timeRange = dateParts[2] || "";
                                const times = timeRange.split(" - ");
                                timeStartStr = times[0] || "";
                                timeEndStr = times[1] || "";
                              } else if (dateParts.length === 2) {
                                dateStr = dateParts[0];
                                const timeRange = dateParts[1] || "";
                                const times = timeRange.split(" - ");
                                timeStartStr = times[0] || "";
                                timeEndStr = times[1] || "";
                              } else {
                                dateStr = evt.date || "";
                              }

                              setEvtDate(parseToDateInput(dateStr));
                              setEvtStartTime(parseToTimeInput(timeStartStr));
                              setEvtEndTime(parseToTimeInput(timeEndStr));

                              const idx = PRESETS.findIndex(p => p.theme === evt.theme);
                              setSelectedPresetIndex(idx >= 0 ? idx : 0);
                              setActiveEventTab("edit");
                            }}
                            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#8D55F3]/10 border border-[#8D55F3]/20 text-[#A57CF4] hover:bg-[#8D55F3]/20 transition-colors"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteEvent(evt.docId || `EVT-${evt.id}`)}
                            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* PANEL 2: CREATE / EDIT FORM */}
              {(activeEventTab === "add" || activeEventTab === "edit") && (
                <form onSubmit={activeEventTab === "edit" ? handleUpdateEvent : handleCreateEvent} className="flex-1 overflow-y-auto space-y-4 pr-1 hide-scrollbar pb-6">
                  {activeEventTab === "edit" && (
                    <div className="bg-[#8D55F3]/10 border border-[#8D55F3]/20 rounded-xl p-3.5 flex justify-between items-center text-xs">
                      <span className="text-[#A57CF4] font-bold">Editing Event: {evtTitle}</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setEditingEventId(null);
                          setActiveEventTab("list");
                        }} 
                        className="text-white/60 hover:text-white font-medium underline"
                      >
                        Cancel Edit
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-white/50 uppercase ml-1">Event Title</label>
                    <input 
                      required 
                      type="text" 
                      placeholder="e.g. NextGen Tech\nSummit 2026 (\n for newline)" 
                      value={evtTitle}
                      onChange={(e) => setEvtTitle(e.target.value)}
                      className="bg-[#2A2A35] rounded-xl px-4 py-3 mt-1 w-full text-white placeholder-white/30 border border-white/5 focus:outline-none focus:border-[#8D55F3] transition-colors text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-white/50 uppercase ml-1">Event Banner Image</label>
                    <div className="mt-1 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl p-4 bg-[#2A2A35]/50 hover:bg-[#2A2A35] transition-colors relative cursor-pointer group min-h-[140px]">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      {evtImage ? (
                        <div className="relative w-full h-28 rounded-lg overflow-hidden flex items-center justify-center">
                          <img src={evtImage} alt="preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-xs font-bold text-white bg-black/40 px-3 py-1.5 rounded-full border border-white/10">Change Image</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-2 flex flex-col items-center">
                          <svg className="mx-auto h-8 w-8 text-white/40 mb-2 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs font-bold text-white/60">Click to upload banner image</span>
                          <span className="text-[10px] text-white/30 mt-1">PNG, JPG, JPEG (Max 1MB)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="text-xs font-bold text-white/50 uppercase ml-1">Event Date</label>
                      <input 
                        required 
                        type="date" 
                        value={evtDate}
                        onChange={(e) => setEvtDate(e.target.value)}
                        className="bg-[#2A2A35] rounded-xl px-4 py-3 mt-1 w-full text-white border border-white/5 focus:outline-none focus:border-[#8D55F3] transition-colors text-xs"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs font-bold text-white/50 uppercase ml-1">Start Time</label>
                      <input 
                        required 
                        type="time" 
                        value={evtStartTime}
                        onChange={(e) => setEvtStartTime(e.target.value)}
                        className="bg-[#2A2A35] rounded-xl px-4 py-3 mt-1 w-full text-white border border-white/5 focus:outline-none focus:border-[#8D55F3] transition-colors text-xs"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs font-bold text-white/50 uppercase ml-1">End Time</label>
                      <input 
                        required 
                        type="time" 
                        value={evtEndTime}
                        onChange={(e) => setEvtEndTime(e.target.value)}
                        className="bg-[#2A2A35] rounded-xl px-4 py-3 mt-1 w-full text-white border border-white/5 focus:outline-none focus:border-[#8D55F3] transition-colors text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-white/50 uppercase ml-1">Venue Location</label>
                    <input 
                      required 
                      type="text" 
                      placeholder="e.g. Javits Center, NYC" 
                      value={evtVenuePill}
                      onChange={(e) => setEvtVenuePill(e.target.value)}
                      className="bg-[#2A2A35] rounded-xl px-4 py-3 mt-1 w-full text-white placeholder-white/30 border border-white/5 focus:outline-none focus:border-[#8D55F3] transition-colors text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-white/50 uppercase ml-1">Extra Registration Fields</label>
                    <input 
                      type="text" 
                      placeholder="e.g. College Name, GitHub Profile (comma separated)" 
                      value={evtExtraFields}
                      onChange={(e) => setEvtExtraFields(e.target.value)}
                      className="bg-[#2A2A35] rounded-xl px-4 py-3 mt-1 w-full text-white placeholder-white/30 border border-white/5 focus:outline-none focus:border-[#8D55F3] transition-colors text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-white/50 uppercase ml-1">Event Description</label>
                    <textarea 
                      required 
                      rows={3}
                      placeholder="Describe the event details, guest speaker highlights, agenda..." 
                      value={evtDescription}
                      onChange={(e) => setEvtDescription(e.target.value)}
                      className="bg-[#2A2A35] rounded-xl px-4 py-3 mt-1 w-full text-white placeholder-white/30 border border-white/5 focus:outline-none focus:border-[#8D55F3] transition-colors text-sm resize-none hide-scrollbar"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-white/50 uppercase ml-1 mb-2 block">Choose Card Visual Style (Theme & Cover Preset)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedPresetIndex(idx)}
                          className={`p-3 rounded-xl border flex flex-col items-start text-left transition-all ${selectedPresetIndex === idx ? "border-[#8D55F3] bg-[#8D55F3]/10" : "border-white/5 bg-[#2A2A35]/30 hover:border-white/10"}`}
                        >
                          <span className="text-xs font-bold text-white">{preset.name}</span>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${preset.theme}`} />
                            <div className={`w-3 h-3 rounded-full ${preset.bgTheme}`} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSavingEvent}
                    className="w-full bg-[#8D55F3] text-white font-bold py-4 rounded-[1.25rem] flex justify-center items-center gap-2 shadow-lg hover:opacity-90 transition-opacity mt-4 text-sm shrink-0"
                  >
                    {isSavingEvent ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : activeEventTab === "edit" ? (
                      "Update Event Details"
                    ) : (
                      "Publish Event Live"
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </>
      )}

      {/* ADMIN USERS HISTORY LIST SHEET */}
      {showUsersList && (
        <>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[60] animate-in fade-in" onClick={() => setShowUsersList(false)} />
          <div className="absolute bottom-0 left-0 w-full z-[70] animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#1C1C22] rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5 max-h-[85vh] flex flex-col">
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 shrink-0"></div>
              
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h3 className="text-xl font-bold">User Registrations</h3>
                <button onClick={() => { setShowUsersList(false); setUserSearchQuery(""); }} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative mb-4 shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/30">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full bg-[#2A2A35]/50 border border-white/5 rounded-xl pl-10 pr-10 py-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#8D55F3] focus:ring-1 focus:ring-[#8D55F3]/30 transition-all shadow-inner"
                />
                {userSearchQuery && (
                  <button
                    onClick={() => setUserSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/40 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Scrollable User Profiles List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[250px] max-h-[50vh] hide-scrollbar mb-4">
                {(() => {
                  const filteredUsers = usersList.filter(user => 
                    user.fullName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                  );

                  if (filteredUsers.length === 0) {
                    return (
                      <div className="bg-[#2A2A35]/30 border border-white/5 rounded-2xl p-8 text-center text-white/40 text-sm">
                        {userSearchQuery ? "No matching users found." : "No users registered yet."}
                      </div>
                    );
                  }

                  return filteredUsers.map((user, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => {
                        setSelectedUserHistory(user);
                        setShowUserHistoryDetail(true);
                      }}
                      className="bg-[#2A2A35]/50 border border-white/5 hover:border-[#8D55F3]/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-[#2A2A35]/75 active:scale-[0.99] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8D55F3] to-[#A57CF4] flex items-center justify-center font-bold text-white uppercase text-sm shrink-0">
                          {user.fullName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm truncate text-white">{user.fullName}</h4>
                          <p className="text-xs text-white/40 truncate mt-0.5">{user.email}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#8D55F3]/10 text-[#A57CF4] border border-[#8D55F3]/20 font-bold">
                          {user.tickets.length} {user.tickets.length === 1 ? "Pass" : "Passes"}
                        </span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ADMIN USER HISTORY POPUP DETAIL SHEET */}
      {showUserHistoryDetail && selectedUserHistory && (
        <>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[80] animate-in fade-in" onClick={() => setShowUserHistoryDetail(false)} />
          <div className="absolute bottom-0 left-0 w-full z-[90] animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#17171C] rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-[#8D55F3]/20 max-h-[80vh] flex flex-col">
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 shrink-0"></div>
              
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-lg font-bold text-[#A57CF4]">User Event Profile</h3>
                <button onClick={() => setShowUserHistoryDetail(false)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User Bio Information */}
              <div className="bg-[#2A2A35]/30 border border-white/5 rounded-2xl p-4.5 mb-6 shrink-0">
                <div className="flex items-center gap-4.5 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#8D55F3]/20 flex items-center justify-center font-bold text-[#A57CF4] text-lg uppercase border border-[#8D55F3]/30">
                    {selectedUserHistory.fullName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-white">{selectedUserHistory.fullName}</h4>
                    <p className="text-xs text-white/40 mt-0.5">{selectedUserHistory.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3.5 text-xs">
                  <div>
                    <span className="text-white/40 block font-medium">Contact Phone</span>
                    <span className="text-white font-semibold mt-0.5 block">{selectedUserHistory.phoneNumber}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block font-medium">Total Passes</span>
                    <span className="text-[#8D55F3] font-bold mt-0.5 block">{selectedUserHistory.tickets.length} Booked</span>
                  </div>
                </div>
              </div>

              {/* Special Entry Requests (Chance Requests) */}
              {(() => {
                const userChanceRequests = chanceRequestsList.filter(
                  (req) => req.userEmail.toLowerCase().trim() === selectedUserHistory.email.toLowerCase().trim()
                );

                if (userChanceRequests.length === 0) return null;

                return (
                  <div className="shrink-0 mb-6 border-b border-white/5 pb-4">
                    <h5 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3 ml-1">Special Entry Requests</h5>
                    <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1 hide-scrollbar">
                      {userChanceRequests.map((req) => (
                        <div key={req.docId} className="bg-[#8D55F3]/5 border border-[#8D55F3]/10 rounded-xl p-3.5 flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1 pr-2">
                              <h6 className="font-bold text-xs text-white truncate">{req.eventName}</h6>
                              <span className="text-[9px] text-white/30 font-mono tracking-tighter block mt-0.5">
                                Requested on: {req.requestedAt?.seconds 
                                  ? new Date(req.requestedAt.seconds * 1000).toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})
                                  : 'Just now'}
                              </span>
                            </div>
                            <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                              req.status === "accepted" 
                                ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                                : req.status === "rejected"
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse"
                            }`}>
                              {req.status}
                            </span>
                          </div>

                          {req.status === "pending" && (
                            <div className="flex gap-2 mt-1">
                              <button 
                                onClick={() => handleApproveChanceRequest(req)}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 rounded-lg text-[10px] transition-colors"
                              >
                                Accept
                              </button>
                              <button 
                                onClick={() => handleDeclineChanceRequest(req)}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 rounded-lg text-[10px] transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <h5 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3 ml-1 shrink-0">Booking History & Attendance</h5>

              {/* Booked Events Scroll */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[150px] max-h-[30vh] hide-scrollbar mb-6">
                {selectedUserHistory.tickets.map((t: any, idx: number) => (
                  <div key={idx} className="bg-[#2A2A35]/45 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                    <div className="min-w-0 pr-4">
                      <h6 className="font-bold text-sm text-white truncate">{t.eventName}</h6>
                      <p className="text-xs text-white/40 mt-1 font-mono tracking-tighter">{t.ticketId}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`text-[9px] px-2.5 py-1 rounded-full font-bold uppercase ${
                        t.status === "Used" 
                          ? "bg-[#34C759]/15 text-[#34C759] border border-[#34C759]/30" 
                          : "bg-white/5 text-white/40 border border-white/10"
                      }`}>
                        {t.status === "Used" ? "Used" : "Not Used"}
                      </span>
                      <span className="block text-[8px] text-white/30 mt-1.5 font-mono">
                        {t.status === "Used" && t.scannedAt?.seconds ? (
                          `Scanned: ${new Date(t.scannedAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                        ) : t.bookedAt?.seconds ? (
                          `Booked: ${new Date(t.bookedAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        ) : (
                          "Valid"
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setShowUserHistoryDetail(false)} 
                className="w-full bg-[#8D55F3]/10 hover:bg-[#8D55F3]/20 text-[#A57CF4] border border-[#8D55F3]/20 font-bold py-4 rounded-[1.25rem] transition-colors shrink-0"
              >
                Back to Users List
              </button>
            </div>
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        #qr-reader {
          border: none !important;
        }
        #qr-reader__dashboard_section_csr span {
          display: none !important;
        }
        #qr-reader__dashboard_section_swaplink {
          color: white !important;
          background: rgba(255,255,255,0.1);
          padding: 8px 16px;
          border-radius: 99px;
          text-decoration: none !important;
          margin-top: 1rem !important;
          display: inline-block !important;
        }
        #qr-reader button {
          display: none !important;
        }
        #qr-reader select {
          display: none !important;
        }
        #qr-reader__scan_region {
          height: 100vh !important;
        }
        #qr-reader__scan_region img {
          opacity: 0.5 !important;
        }
      `}} />
    </div>
  );
}
