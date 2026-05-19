"use client";

import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, MoreHorizontal, Share, Clock, MapPin, Home as HomeIcon, Bell, Wallet, PlusSquare, X, Map as MapIcon, Menu, LogOut, CheckCircle2, Ticket } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, onSnapshot, addDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

type TicketData = {
  ticketId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  eventName: string;
  status: string;
  bookedAt: string;
};

const EVENTS = [
  {
    id: 1,
    title: "Pre ETHGlobal\nBuilder Demo Day",
    shortTitle: "Pre ETHGlobal SF",
    subtitle: "Learn more on buildweek.xyz",
    date: "October 17th, 2PM - 6PM",
    timePill: "17:00",
    venuePill: "Edge & Node",
    theme: "from-[#FFEFD5] to-[#FFE4B5]",
    textColor: "text-[#333333]",
    bgTheme: "bg-[#6552D0]"
  },
  {
    id: 2,
    title: "NextGen Tech\nSummit 2026",
    shortTitle: "NextGen NYC",
    subtitle: "Learn more on nextgen.tech",
    date: "November 12th, 10AM - 4PM",
    timePill: "10:00",
    venuePill: "Javits Center",
    theme: "from-blue-100 to-indigo-200",
    textColor: "text-indigo-900",
    bgTheme: "bg-[#4F46E5]"
  },
  {
    id: 3,
    title: "Web3 Founders\nMeetup Miami",
    shortTitle: "Web3 Miami",
    subtitle: "Learn more on web3miami.io",
    date: "December 5th, 6PM - 9PM",
    timePill: "18:00",
    venuePill: "The Lab Miami",
    theme: "from-pink-100 to-rose-200",
    textColor: "text-rose-900",
    bgTheme: "bg-[#E11D48]"
  }
];

export default function UserHome() {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [activeEventIndex, setActiveEventIndex] = useState(0);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [joinedEvents, setJoinedEvents] = useState<TicketData[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Dynamic Events State
  const [events, setEvents] = useState<any[]>(EVENTS);

  // Notifications State
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const activeEvent = events[activeEventIndex] || EVENTS[0];

  // Active Event Registrations list (Avatars Stack)
  const [eventRegistrations, setEventRegistrations] = useState<{ photoURL: string; fullName: string }[]>([]);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [showRegisteredEventsModal, setShowRegisteredEventsModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
  });

  // Listen to registrations for active event
  useEffect(() => {
    if (!db || !activeEvent) return;
    
    const eventName = activeEvent.title.replace('\n', ' ');
    const q = query(
      collection(db, "tickets"),
      where("eventName", "==", eventName)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const registrations: { photoURL: string; fullName: string }[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        registrations.push({
          photoURL: data.photoURL || "",
          fullName: data.fullName || "User"
        });
      });
      setEventRegistrations(registrations);
    });
    
    return () => unsubscribe();
  }, [activeEvent, db]);

  // Deep-link to shared event ID in URL query parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const eventIdParam = urlParams.get("event");
      if (eventIdParam && events.length > 0) {
        const foundIndex = events.findIndex(e => String(e.id) === eventIdParam);
        if (foundIndex !== -1 && foundIndex !== activeEventIndex) {
          setActiveEventIndex(foundIndex);
          setTimeout(() => {
            if (scrollContainerRef.current) {
              const cardWidth = scrollContainerRef.current.offsetWidth;
              scrollContainerRef.current.scrollTo({
                left: foundIndex * cardWidth,
                behavior: "smooth"
              });
            }
          }, 500);
        }
      }
    }
  }, [events]);

  const fetchUserHistory = async (email: string) => {
    // Handled in real-time useEffect listener below
  };

  // Real-time Tickets Listener
  useEffect(() => {
    if (!db || !userEmail) return;

    const q = query(collection(db, "tickets"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TicketData[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.email && data.email.toLowerCase().trim() === userEmail.toLowerCase().trim()) {
          list.push(data as TicketData);
        }
      });
      setJoinedEvents(list);
    }, (err) => {
      console.error("Error in real-time tickets listener:", err);
    });

    return () => unsubscribe();
  }, [userEmail, db]);

  // Sync active ticket state with real-time joinedEvents list updates
  useEffect(() => {
    if (ticket && joinedEvents.length > 0) {
      const updatedTicket = joinedEvents.find(t => t.ticketId === ticket.ticketId);
      if (updatedTicket && JSON.stringify(updatedTicket) !== JSON.stringify(ticket)) {
        setTicket(updatedTicket);
      }
    }
  }, [joinedEvents, ticket]);

  const fetchNotifications = async () => {
    // Handled in real-time useEffect listener below
  };

  useEffect(() => {
    if (!db || !userEmail) return;

    const q = query(collection(db, "notifications"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Show if global (no userEmail) OR if it matches this user's email
        if (!data.userEmail || data.userEmail.toLowerCase() === userEmail.toLowerCase()) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      // Sort by createdAt descending
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setNotificationsList(list);
      
      const lastSeen = localStorage.getItem("lastSeenNotificationId");
      if (list.length > 0 && list[0].id !== lastSeen) {
        setHasNewNotification(true);
      } else {
        setHasNewNotification(false);
      }
    }, (err) => {
      console.error("Error in real-time notifications listener:", err);
    });

    return () => unsubscribe();
  }, [userEmail, db]);

  const openNotifications = () => {
    setShowNotifications(true);
    setShowProfile(false);
    setShowRegisteredEventsModal(false);
    if (notificationsList.length > 0) {
      localStorage.setItem("lastSeenNotificationId", notificationsList[0].id);
      setHasNewNotification(false);
    }
  };

  const fetchEvents = async () => {
    if (!db) return;
    try {
      const q = query(collection(db, "events"));
      const querySnapshot = await getDocs(q);
      const list: any[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (list.length > 0) {
        list.sort((a, b) => Number(b.id) - Number(a.id));
        setEvents(list);
      } else {
        await seedDefaultEvents();
      }
    } catch (err) {
      console.error("Error fetching events:", err);
    }
  };

  const seedDefaultEvents = async () => {
    if (!db) return;
    try {
      for (const evt of EVENTS) {
        const docId = `EVT-${evt.id}`;
        await setDoc(doc(db, "events", docId), {
          id: evt.id,
          title: evt.title,
          shortTitle: evt.shortTitle,
          subtitle: evt.subtitle,
          date: evt.date,
          timePill: evt.timePill,
          venuePill: evt.venuePill,
          theme: evt.theme,
          bgTheme: evt.bgTheme,
          textColor: evt.textColor,
          imageUrl: `https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80`
        });
      }
      // Re-fetch after seeding
      const q = query(collection(db, "events"));
      const querySnapshot = await getDocs(q);
      const list: any[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => Number(b.id) - Number(a.id));
      setEvents(list);
    } catch (err) {
      console.error("Error seeding default events:", err);
    }
  };

  // Check auth - redirect to login if not authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        setUserEmail(user.email || "");
        setUserName(user.displayName || user.email?.split("@")[0] || "User");
        setUserPhoto(user.photoURL || null);
        // Pre-fill form with Google profile info
        setFormData(prev => ({
          ...prev,
          fullName: user.displayName || "",
          email: user.email || "",
        }));
        fetchUserHistory(user.email || "");
        fetchNotifications();
        fetchEvents();
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      const shareUrl = `${window.location.origin}/home?event=${activeEvent.id}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        triggerToast("Share link copied to clipboard!");
      }).catch(() => {
        triggerToast("Failed to copy link.");
      });
    }
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const cardWidth = scrollContainerRef.current.offsetWidth;
      const index = Math.round(scrollLeft / cardWidth);
      setActiveEventIndex(index);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const eventName = activeEvent.title.replace('\n', ' ');
    const ticketId = `PK-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    try {
      const normalizedEmail = formData.email.toLowerCase().trim();
      await setDoc(doc(db, "tickets", ticketId), {
        ticketId,
        fullName: formData.fullName,
        email: normalizedEmail,
        phoneNumber: formData.phoneNumber,
        eventName,
        status: "Valid",
        bookedAt: serverTimestamp(),
        photoURL: auth.currentUser?.photoURL || "",
      });
      await addDoc(collection(db, "notifications"), {
        title: `🎟️ Ticket Booked: ${eventName}`,
        message: `Hi ${formData.fullName}, your registration for "${eventName}" is confirmed! Ticket ID is ${ticketId}.`,
        userEmail: normalizedEmail,
        createdAt: serverTimestamp()
      });
      await fetchUserHistory(userEmail);
    } catch (error) {
      console.error("Error saving ticket:", error);
    }

    setTicket({
      ...formData,
      eventName,
      ticketId,
      status: "Valid",
      bookedAt: new Date().toISOString(),
    });
    setIsSubmitting(false);
    setShowForm(false);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const avatars = [
    "https://i.pravatar.cc/100?img=1",
    "https://i.pravatar.cc/100?img=2",
    "https://i.pravatar.cc/100?img=3",
    "https://i.pravatar.cc/100?img=4",
  ];

  if (!isAuthReady) {
    return (
      <div className="w-full h-[100dvh] flex items-center justify-center bg-[#1A1A1F]">
        <div className="w-8 h-8 border-4 border-[#8D55F3]/30 border-t-[#8D55F3] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[100dvh] flex flex-col bg-[#1A1A1F] text-white overflow-hidden font-sans">
      
      {!ticket ? (
        // LANDING PAGE VIEW
        <div className="flex-1 flex flex-col overflow-y-auto pb-32 hide-scrollbar">
          
          {/* THE MAIN PURPLE CONTAINER */}
          <div className={`${activeEvent.bgTheme} pt-14 pb-8 px-5 rounded-b-[2.5rem] relative transition-colors duration-500 shadow-2xl`}>

            {/* Top Navigation */}
            <div className="flex items-center justify-between mb-8">
              {/* User avatar / profile trigger */}
              <button 
                onClick={() => {
                  fetchUserHistory(userEmail);
                  setShowProfile(true);
                }} 
                className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 overflow-hidden hover:scale-105 active:scale-95 transition-transform" 
                title="Profile & History"
              >
                {userPhoto && !photoError ? (
                  <img 
                    src={userPhoto} 
                    alt="profile" 
                    className="w-full h-full object-cover" 
                    onError={() => setPhotoError(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-white/15 flex items-center justify-center font-bold text-white uppercase text-sm">
                    {userName.charAt(0)}
                  </div>
                )}
              </button>

              {/* Pagination Dots */}
              <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-4 py-2 backdrop-blur-md border border-white/10">
                {events.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === activeEventIndex ? "w-4 bg-white" : "w-1.5 bg-white/40"}`} />
                ))}
              </div>

              <button 
                onClick={handleShare}
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/20 transition-colors"
              >
                <Share className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Welcome + Title */}
            <div className="text-center mb-6">
              <p className="text-white/60 text-xs mb-1">Welcome back, {userName} 👋</p>
              <h1 className="text-[28px] font-bold text-white leading-[1.1] mb-2 whitespace-pre-line tracking-tight">
                {activeEvent.title}
              </h1>
            </div>

            {/* Horizontal Scrollable Events Cards */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 mb-6 -mx-5 px-5"
            >
              {events.map((evt) => (
                <div key={evt.id} className="w-full min-w-full snap-center flex-shrink-0 relative">
                  {evt.id > 3 && (
                    <span className="absolute top-4 right-4 bg-gradient-to-r from-[#FF9500] to-[#FF5E00] text-white text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full shadow-lg z-20 animate-pulse">
                      NEW
                    </span>
                  )}
                  <div className={`rounded-3xl shadow-lg aspect-square relative flex flex-col overflow-hidden bg-gradient-to-b ${evt.theme}`}>
                    {evt.imageUrl ? (
                      <img src={evt.imageUrl} alt={evt.title} className="absolute inset-0 w-full h-full object-cover z-0" />
                    ) : null}
                    {evt.imageUrl && <div className="absolute inset-0 bg-black/40 z-10" />}
                    
                    <div className="relative z-20 flex-1 flex flex-col items-center justify-center text-center p-5">
                      {!evt.imageUrl ? (
                        <h2 className={`text-2xl font-black uppercase tracking-tighter mix-blend-overlay ${evt.textColor} whitespace-pre-line`}>
                          {evt.title}
                        </h2>
                      ) : null}
                    </div>
                    <div className="relative z-20 mt-auto pb-5 text-center px-5">
                      <p className={`font-bold font-mono tracking-tighter ${evt.imageUrl ? 'text-white drop-shadow-md text-sm' : evt.textColor}`}>{evt.date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Glass Pills */}
            <div className="mb-6">
              <div className="w-full bg-white/15 backdrop-blur-md py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 border border-white/10">
                <MapPin className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-white">{activeEvent.venuePill}</span>
              </div>
            </div>

            {/* Register Button */}
            {joinedEvents.some(
              (t) => t.eventName.toLowerCase() === activeEvent.title.replace('\n', ' ').toLowerCase() ||
                     t.eventName.toLowerCase() === activeEvent.shortTitle.toLowerCase()
            ) ? (
              <button
                disabled
                className="w-full bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/30 font-bold text-lg py-4 rounded-[1.25rem] flex items-center justify-center gap-2 mb-6 cursor-not-allowed"
              >
                <CheckCircle2 className="w-5 h-5" /> Registered
              </button>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="w-full bg-white text-black font-bold text-lg py-4 rounded-[1.25rem] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-2 mb-6"
              >
                Register
              </button>
            )}

            {/* Avatars Row */}
            <div className="flex items-center justify-between">
              <button 
                onClick={() => {
                  const userTicket = joinedEvents.find(
                    (t) => t.eventName.toLowerCase() === activeEvent.title.replace('\n', ' ').toLowerCase() ||
                           t.eventName.toLowerCase() === activeEvent.shortTitle.toLowerCase()
                  );
                  if (userTicket) {
                    setTicket(userTicket);
                  } else {
                    triggerToast("You are not registered for this event yet!");
                  }
                }}
                className="w-12 h-12 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/25 transition-all"
                title="Show My Ticket"
              >
                <MapIcon className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center">
                {eventRegistrations.length === 0 ? (
                  <div className="text-white/40 text-xs font-medium bg-white/5 py-1.5 px-3 rounded-full border border-white/5">
                    No registrations yet
                  </div>
                ) : (
                  <>
                    <div className="flex -space-x-3">
                      {eventRegistrations.slice(0, 4).map((reg, i) => (
                        <img 
                          key={i} 
                          src={reg.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(reg.fullName)}&background=random&color=fff`} 
                          alt="avatar" 
                          className="w-10 h-10 rounded-full border-2 border-[#1A1A1F] object-cover bg-white" 
                        />
                      ))}
                    </div>
                    {eventRegistrations.length > 4 && (
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#6552D0] font-black text-xs -ml-3 relative z-10 shadow-md">
                        +{eventRegistrations.length - 4}
                      </div>
                    )}
                  </>
                )}
              </div>
              <button 
                onClick={() => setShowDescriptionModal(true)}
                className="w-12 h-12 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/25 transition-all"
                title="Event Description"
              >
                <Menu className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Location */}
          <div className="px-5 pt-8">
            <h3 className="font-bold text-[22px] mb-4 text-white/90">Location</h3>
            <div className="h-40 bg-[#2A2A35] rounded-[2rem] border border-white/5 overflow-hidden relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#8D55F3]">
                <MapPin className="w-8 h-8 drop-shadow-lg" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        // TICKET VIEW
        <div className="flex-1 flex flex-col h-full bg-[#1A1A1F] relative overflow-y-auto pb-24">
          <div className="px-5 pt-14 pb-6">
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => setTicket(null)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <h1 className="flex-1 font-semibold text-center truncate">{ticket.eventName}</h1>
              <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                <MoreHorizontal className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex gap-3 mb-6">
              <div className="flex-1 bg-[#6552D0]/20 py-2 px-4 rounded-full flex items-center justify-center gap-2 border border-[#6552D0]/30">
                <Clock className="w-3.5 h-3.5 text-[#A57CF4]" />
                <span className="text-xs font-medium text-[#A57CF4]">17:00 • 20 Oct</span>
              </div>
              <div className="flex-1 bg-[#2A2A35] py-2 px-4 rounded-full flex items-center justify-center gap-2 border border-white/5">
                <MapPin className="w-3.5 h-3.5 text-white/70" />
                <span className="text-xs font-medium text-white/70">Edge & Node</span>
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Your Ticket</h2>
              <p className="text-white/50 text-sm mt-1">{ticket.fullName}</p>
            </div>

            {/* Big White QR Card */}
            <div className="bg-white rounded-[2rem] p-8 flex flex-col items-center justify-center relative mb-8 shadow-[0_20px_40px_rgba(0,0,0,0.4)] mx-4">
              <div className="absolute top-1/2 -left-4 -translate-y-1/2 w-8 h-8 rounded-full bg-[#1A1A1F]"></div>
              <div className="absolute top-1/2 -right-4 -translate-y-1/2 w-8 h-8 rounded-full bg-[#1A1A1F]"></div>
              <QRCodeSVG value={ticket.ticketId} size={220} level="H" includeMargin={false} />
              <p className="mt-4 font-mono text-xs text-gray-400">{ticket.ticketId}</p>
            </div>

            <div className="flex gap-4 px-4 mb-6">
              <button className="flex-1 bg-[#2A2A35] py-4 rounded-[1.25rem] flex items-center justify-center gap-2 text-sm font-semibold">
                <Share className="w-4 h-4" /> Transfer
              </button>
              <button className="flex-1 bg-white text-black py-4 rounded-[1.25rem] flex items-center justify-center gap-2 text-sm font-bold">
                <Wallet className="w-4 h-4" /> Add to Wallet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL BOTTOM NAVIGATION */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[340px] z-50">
        <div className="bg-[#2A2A35]/80 backdrop-blur-xl border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.5)] rounded-full px-5 py-2.5 flex items-center justify-between">
          {/* Home Button */}
          <button 
            onClick={() => {
              setShowProfile(false);
              setShowNotifications(false);
              setShowRegisteredEventsModal(false);
              setTicket(null);
            }}
            className={`${(!showProfile && !showNotifications && !showRegisteredEventsModal && !ticket) ? "text-[#8D55F3]" : "text-white/40 hover:text-white"} transition-colors relative flex items-center justify-center p-1.5`}
            title="Home"
          >
            <HomeIcon className="w-5 h-5" />
          </button>

          {/* Notifications Button */}
          <button 
            onClick={openNotifications}
            className={`${showNotifications ? "text-[#8D55F3]" : "text-white/40 hover:text-white"} transition-colors relative flex items-center justify-center p-1.5`}
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {hasNewNotification && (
              <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#FF4444] rounded-full border border-[#2A2A35]"></div>
            )}
          </button>

          {/* Registered Events / Tickets Button */}
          <button 
            onClick={() => {
              fetchUserHistory(userEmail);
              setShowRegisteredEventsModal(true);
              setShowProfile(false);
              setShowNotifications(false);
            }}
            className={`${showRegisteredEventsModal ? "text-[#8D55F3]" : "text-white/40 hover:text-white"} transition-colors relative flex items-center justify-center p-1.5`}
            title="My Tickets"
          >
            <Ticket className="w-5 h-5" />
            {joinedEvents.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#8D55F3] text-white text-[9px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center scale-90 border border-[#2A2A35]">
                {joinedEvents.length}
              </span>
            )}
          </button>

          {/* Profile Button */}
          <button 
            onClick={() => {
              fetchUserHistory(userEmail);
              setShowProfile(true);
              setShowNotifications(false);
              setShowRegisteredEventsModal(false);
            }} 
            className={`${showProfile ? "text-[#8D55F3] border-[#8D55F3]" : "text-white/40 border-white/10 hover:text-white"} transition-all w-8 h-8 rounded-full flex items-center justify-center border overflow-hidden`} 
            title="Profile"
          >
            {userPhoto && !photoError ? (
              <img 
                src={userPhoto} 
                alt="profile" 
                className="w-full h-full object-cover" 
                onError={() => setPhotoError(true)}
              />
            ) : (
              <div className="w-full h-full bg-white/10 flex items-center justify-center font-bold text-xs text-white uppercase">
                {userName.charAt(0)}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* REGISTRATION BOTTOM SHEET */}
      {showForm && (
        <>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[60] animate-in fade-in" onClick={() => setShowForm(false)} />
          <div className="absolute bottom-0 left-0 w-full z-[70] animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#1C1C22] rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5">
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6"></div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Register</h3>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 uppercase mb-1.5 ml-1">Full Name</label>
                  <input required type="text" name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Your full name"
                    className="bg-[#2A2A35] rounded-xl px-4 py-3.5 w-full text-white placeholder-white/40 border border-white/5 focus:outline-none focus:border-[#6552D0] transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 uppercase mb-1.5 ml-1">Email</label>
                  <input required type="email" name="email" value={formData.email} onChange={handleChange} placeholder="your@email.com"
                    className="bg-[#2A2A35] rounded-xl px-4 py-3.5 w-full text-white placeholder-white/40 border border-white/5 focus:outline-none focus:border-[#6552D0] transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 uppercase mb-1.5 ml-1">Phone</label>
                  <input required type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="+91 98765 43210"
                    className="bg-[#2A2A35] rounded-xl px-4 py-3.5 w-full text-white placeholder-white/40 border border-white/5 focus:outline-none focus:border-[#6552D0] transition-colors" />
                </div>
                <button type="submit" disabled={isSubmitting} className={`w-full text-white font-bold py-4 rounded-[1.25rem] mt-6 flex justify-center shadow-lg transition-colors ${activeEvent.bgTheme} hover:opacity-90`}>
                  {isSubmitting ? <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Confirm Registration"}
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* USER PROFILE & BOOKING HISTORY BOTTOM SHEET */}
      {showProfile && (
        <>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[60] animate-in fade-in" onClick={() => setShowProfile(false)} />
          <div className="absolute bottom-0 left-0 w-full z-[70] animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#1C1C22] rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5 max-h-[85vh] flex flex-col">
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 shrink-0"></div>
              
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-bold">Profile Dashboard</h3>
                <button onClick={() => setShowProfile(false)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User profile picture & email info */}
              <div className="flex flex-col items-center text-center mb-8 shrink-0">
                <div className="relative mb-3">
                  {userPhoto ? (
                    <img src={userPhoto} alt="profile" className="w-20 h-20 rounded-full border-2 border-[#8D55F3] object-cover shadow-lg" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-[#8D55F3]/20 border-2 border-[#8D55F3] flex items-center justify-center text-2xl font-bold text-[#A57CF4] uppercase">
                      {userName.charAt(0)}
                    </div>
                  )}
                </div>
                <h4 className="text-lg font-bold">{userName}</h4>
                <p className="text-white/40 text-xs mt-0.5">{userEmail}</p>
              </div>

              {/* Joined passes title */}
              <h5 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3 ml-1 shrink-0">My Booked Passes</h5>

              {/* Scrollable event passes list */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[150px] max-h-[30vh] hide-scrollbar mb-8">
                {joinedEvents.length === 0 ? (
                  <div className="bg-[#2A2A35]/30 border border-white/5 rounded-2xl p-5 text-center text-white/40 text-sm">
                    No tickets booked yet.
                  </div>
                ) : (
                  joinedEvents.map((t, idx) => (
                    <div key={idx} className="bg-[#2A2A35]/50 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-4">
                        <h6 className="font-bold text-sm truncate">{t.eventName}</h6>
                        <p className="text-xs text-white/40 mt-1 font-mono">{t.ticketId}</p>
                      </div>
                      <div className="shrink-0">
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20 font-bold uppercase">
                          {t.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Sign out button */}
              <button
                onClick={handleSignOut}
                className="w-full bg-[#FF4444]/10 hover:bg-[#FF4444]/20 text-[#FF4444] border border-[#FF4444]/20 font-bold py-4 rounded-[1.25rem] flex items-center justify-center gap-2 transition-colors shrink-0"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* USER NOTIFICATIONS BOTTOM SHEET */}
      {showNotifications && (
        <>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[60] animate-in fade-in" onClick={() => setShowNotifications(false)} />
          <div className="absolute bottom-0 left-0 w-full z-[70] animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#1C1C22] rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5 max-h-[85vh] flex flex-col">
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 shrink-0"></div>
              
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-bold">Notifications</h3>
                <button onClick={() => setShowNotifications(false)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable notifications list */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 min-h-[250px] max-h-[50vh] hide-scrollbar mb-4">
                {notificationsList.length === 0 ? (
                  <div className="bg-[#2A2A35]/30 border border-white/5 rounded-2xl p-8 text-center text-white/40 text-sm">
                    No announcements or notifications yet.
                  </div>
                ) : (
                  notificationsList.map((notif) => (
                    <div key={notif.id} className="bg-[#2A2A35]/50 border border-[#8D55F3]/15 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 h-full w-1 bg-[#8D55F3]/80"></div>
                      <div className="flex justify-between items-start mb-1 pl-2">
                        <h4 className="font-bold text-sm text-[#A57CF4]">{notif.title}</h4>
                        <span className="text-[10px] text-white/30">
                          {notif.createdAt?.seconds 
                            ? new Date(notif.createdAt.seconds * 1000).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) 
                            : 'Just now'}
                        </span>
                      </div>
                      <p className="text-xs text-white/70 pl-2 leading-relaxed">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* EVENT DESCRIPTION BOTTOM SHEET */}
      {showDescriptionModal && (
        <>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-[60] animate-in fade-in" onClick={() => setShowDescriptionModal(false)} />
          <div className="absolute bottom-0 left-0 w-full z-[70] animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#1C1C22] rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5 max-h-[85vh] flex flex-col">
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 shrink-0"></div>
              
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-bold">About Event</h3>
                <button onClick={() => setShowDescriptionModal(false)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Event Description Text */}
              <div className="flex-1 overflow-y-auto text-white/80 text-sm leading-relaxed pr-1 hide-scrollbar mb-4 bg-white/5 rounded-2xl p-4 border border-white/5">
                {activeEvent.description ? (
                  <p className="whitespace-pre-line">{activeEvent.description}</p>
                ) : (
                  <p className="text-white/40 text-center py-4">No description has been added for this event yet.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* REGISTERED EVENTS / TICKETS BOTTOM SHEET */}
      {showRegisteredEventsModal && (
        <>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-[60] animate-in fade-in" onClick={() => setShowRegisteredEventsModal(false)} />
          <div className="absolute bottom-0 left-0 w-full z-[70] animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#1C1C22] rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5 max-h-[85vh] flex flex-col">
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 shrink-0"></div>
              
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-bold">My Registered Events</h3>
                <button onClick={() => setShowRegisteredEventsModal(false)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Registered Events List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[220px] max-h-[50vh] hide-scrollbar mb-4">
                {joinedEvents.length === 0 ? (
                  <div className="bg-[#2A2A35]/30 border border-white/5 rounded-2xl p-8 text-center text-white/40 text-sm">
                    You have not registered for any events yet.
                  </div>
                ) : (
                  joinedEvents.map((t, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => {
                        setTicket(t);
                        setShowRegisteredEventsModal(false);
                      }}
                      className="bg-[#2A2A35]/50 hover:bg-[#2A2A35]/80 border border-white/5 hover:border-[#8D55F3]/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all duration-200 group active:scale-[0.99]"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <h4 className="font-bold text-sm truncate text-white group-hover:text-[#A57CF4] transition-colors">{t.eventName}</h4>
                        <p className="text-xs text-white/40 mt-1 font-mono">{t.ticketId}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {t.status === "Used" ? (
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#FF4444]/15 text-[#FF4444] border border-[#FF4444]/30 font-bold uppercase">
                            Used
                          </span>
                        ) : (
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#34C759]/15 text-[#34C759] border border-[#34C759]/30 font-bold uppercase">
                            Not Used
                          </span>
                        )}
                        <svg className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
      {toastMessage && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[100] bg-white/10 backdrop-blur-xl border border-white/20 px-5 py-3 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in duration-200">
          <p className="text-white text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#34C759]" /> {toastMessage}
          </p>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `.hide-scrollbar::-webkit-scrollbar { display: none; }`}} />
    </div>
  );
}
