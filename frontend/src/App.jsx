import { useState, useEffect } from 'react';
import './App.css';
import { db, auth } from './firebase'; 
import { collection, addDoc, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';

// =========================================
// --- OFFLINE DOWNLOAD STORAGE (IndexedDB) ---
// Saves file blobs inside the browser's own database.
// Does NOT touch the phone's photo gallery or file system.
// =========================================
const DB_NAME = "nsuArchiveOfflineDB";
const STORE_NAME = "downloads";

const openOfflineDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const dbInstance = e.target.result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

const saveFileOffline = async (docItem, blob) => {
  const dbInstance = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({
      id: docItem.id,
      title: docItem.title,
      subject: docItem.subject || '',
      docType: docItem.docType || '',
      course: docItem.course || '',
      stream: docItem.stream || '',
      sem: docItem.sem || '',
      blob,
      savedAt: new Date().toISOString()
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
};

const getAllOfflineFiles = async () => {
  const dbInstance = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

const deleteOfflineFile = async (id) => {
  const dbInstance = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
};

// =========================================
// --- DEMO-READY MODERN AESTHETIC CSS ---
// =========================================
const AppStyles = () => (
  <style>{`
    :root { font-size: 15px; }

    /* FIX: FORCING TEXT VISIBILITY IN INPUTS AND SELECTS */
    input, select, textarea, option {
      color: #000000 !important; /* Force black text */
      background-color: #ffffff !important; /* Force white background */
    }

    /* FIX: MAKING HEADINGS DARK AND VISIBLE */
    .hero-text h2, .portal-title {
      color: #111827 !important; /* Pure Dark/Black for high visibility */
      font-weight: 800 !important;
      text-align: center;
      margin-bottom: 10px;
    }
    .hero-text p {
      color: #333333 !important; /* Dark Grey/Black for subheadings */
      font-weight: 600 !important;
      text-align: center;
      margin-bottom: 30px;
    }

    /* EXACTLY 4 ON TOP, 4 ON BOTTOM */
    .category-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr); /* Forces exactly 4 columns */
      gap: 20px;
      margin: 30px 0;
    }
    
    /* Just in case someone looks on a phone later */
    @media (max-width: 900px) {
      .category-grid { grid-template-columns: repeat(2, 1fr); }
    }
    
    .cat-card {
      padding: 25px 20px;
      border-radius: 16px;
      text-align: center;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      box-shadow: 0 4px 6px rgba(0,0,0,0.02);
    }
    
    .cat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 10px 15px rgba(0,0,0,0.05);
    }

    .cat-icon {
      font-size: 2.5rem;
      margin-bottom: 10px;
      display: block;
    }

    /* Beautiful Input & Select Fields */
    .form-stack input[type="text"], 
    .input-group select, 
    .form-stack select {
      width: 100%;
      height: 44px; 
      padding: 0 15px;
      border: 1px solid #cbd5e1; 
      border-radius: 8px; 
      font-size: 0.95rem;
      transition: all 0.2s ease;
      box-sizing: border-box; 
      margin-bottom: 5px; 
      color: #000000 !important; /* Fix color */
    }

    .form-stack input[type="text"]:focus, 
    .input-group select:focus, 
    .form-stack select:focus {
      border-color: #3b82f6; 
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); 
      outline: none;
    }

    .input-group label {
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 6px;
      font-size: 0.9rem;
      display: block;
    }
    
    .filter-stack {
      display: grid;
      grid-template-columns: 1fr;
      gap: 15px;
      margin-bottom: 20px;
    }
    @media (min-width: 768px) {
      .filter-stack { grid-template-columns: 1fr 1fr 1fr; }
      .row-group { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    }
    
    .contribution-form .form-stack { gap: 15px; }

    /* Beautified Course List */
    .course-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 20px;
    }
    .course-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
      transition: transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
    }
    .course-row:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.06);
      border-color: #cbd5e1;
    }
    .course-info strong {
      font-size: 1.15rem;
      color: #1e293b;
    }
    .btn-browse-course {
      padding: 8px 18px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-browse-course:hover { background: #2563eb; }

    /* FIX: Beautified Filter Toggles (Horizontal Scroll for Mobile) */
    .onoff-filter-group { 
      background: #f1f5f9; 
      padding: 4px; 
      border-radius: 50px; 
      display: flex; 
      flex-wrap: nowrap; /* Forces one line */
      overflow-x: auto;  /* Enables swiping */
      white-space: nowrap; 
      gap: 4px; 
      /* Hides the scrollbar for a cleaner look */
      -ms-overflow-style: none; 
      scrollbar-width: none; 
    }
    .onoff-filter-group::-webkit-scrollbar { display: none; }

    .btn-filter-pill {
      background: transparent; border: none; border-radius: 50px; padding: 6px 18px;
      font-size: 0.85rem; font-weight: 500; color: #475569; cursor: pointer; transition: all 0.2s ease;
    }
    .btn-filter-pill.active { background: #3b82f6; color: white; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2); }
    .btn-filter-pill:hover:not(.active) { background: rgba(59, 130, 246, 0.05); color: #3b82f6; }

    /* Buttons & Empty States */
    .btn-submit-large { padding: 12px 24px; background: #3b82f6; border-radius: 8px; font-weight: 600; width: 100%; color: white; border: none; cursor: pointer; }
    .btn-submit-large:disabled { background: #94a3b8; }
    
    .btn-open { padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; }
    
    .empty-state { background: #f1f5f9; padding: 15px; border-radius: 8px; font-style: italic; color: #64748b; }

    /* Upload Input Wrapper */
    .file-input-wrapper { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px dashed #cbd5e1; }
    .modern-file-input { font-size: 0.9rem; color: #64748b; margin-top: 5px; width: 100%; }
    
    /* FAQ SECTION STYLES */
    .faq-section {
      margin-top: 50px;
      margin-bottom: 20px;
      padding-top: 30px;
      border-top: 1px solid #e2e8f0;
    }
    .faq-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    @media (min-width: 768px) {
      .faq-grid { grid-template-columns: repeat(3, 1fr); }
    }
    .faq-card {
      background: #ffffff;
      padding: 25px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px rgba(0,0,0,0.02);
      text-align: left;
    }
    .faq-card h4 { color: #0f172a; margin-bottom: 12px; font-size: 1.1rem; font-weight: 700; }
    .faq-card p { color: #475569; font-size: 0.95rem; line-height: 1.6; margin: 0; }

    /* FIX: Footer Styling */
    .home-footer {
      text-align: center;
      padding: 30px 20px 20px;
      color: #000000; /* Made it Pitch Black */
      font-size: 1rem;
      font-weight: 700; /* Made it bold */
      margin-top: auto;
    }

    /* =========================================
        NEW: STAR RATING STYLES
       ========================================= */
    .star-row { display: flex; align-items: center; gap: 2px; margin-top: 6px; }
    .star { font-size: 1.1rem; cursor: pointer; color: #d1d5db; transition: transform 0.1s, color 0.1s; line-height: 1; }
    .star.filled { color: #f59e0b; }
    .star:hover { transform: scale(1.2); }
    .rating-count { font-size: 0.78rem; color: #64748b; margin-left: 6px; }
    .rating-readonly { display: flex; align-items: center; gap: 2px; }
    .rating-readonly .star { cursor: default; }
    .rating-readonly .star:hover { transform: none; }

    /* =========================================
        NEW: DOWNLOAD / OFFLINE PAGE STYLES
       ========================================= */
    .btn-download { 
      padding: 10px 16px; background: #10b981; color: white; border: none; 
      border-radius: 8px; font-weight: 500; cursor: pointer; display: inline-flex; 
      align-items: center; gap: 6px; font-size: 0.9rem;
    }
    .btn-download:hover { background: #059669; }
    .btn-download:disabled { background: #94a3b8; cursor: not-allowed; }
    .btn-downloaded { background: #e2e8f0; color: #475569; }
    .btn-downloaded:hover { background: #e2e8f0; }

    .doc-actions-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

    .offline-doc-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 15px; background: #f8fafc; border-radius: 10px; margin-top: 10px;
      border: 1px solid #e2e8f0;
    }
    .offline-doc-info p { color: #64748b; font-size: 0.85rem; margin: 4px 0 0 0; }
    .btn-remove-offline {
      padding: 8px 14px; background: #fee2e2; color: #b91c1c; border: none;
      border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 0.85rem;
    }
    .btn-remove-offline:hover { background: #fecaca; }
    .offline-badge {
      background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px;
      font-size: 0.75rem; font-weight: 700; margin-left: 6px;
    }

    /* =========================================
        HAMBURGER DROPDOWN MENU (Admin / Downloads / Logout)
       ========================================= */
    .menu-wrapper { position: relative; }
    .btn-hamburger {
      background: none; border: none; cursor: pointer;
      display: flex; flex-direction: column; justify-content: center;
      gap: 5px; width: 32px; height: 32px; padding: 0;
    }
    .btn-hamburger span {
      display: block; width: 100%; height: 2.5px;
      background: #1e293b; border-radius: 2px;
    }
    .menu-overlay {
      position: fixed; inset: 0; background: transparent; z-index: 998;
    }
    .dropdown-menu {
      position: absolute; top: calc(100% + 10px); right: 0;
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.12);
      display: flex; flex-direction: column;
      min-width: 200px; overflow: hidden; z-index: 999;
    }
    .dropdown-item {
      background: none; border: none; text-align: left;
      padding: 14px 18px; font-size: 0.95rem; font-weight: 600;
      color: #1e293b; cursor: pointer; border-bottom: 1px solid #f1f5f9;
    }
    .dropdown-item:last-child { border-bottom: none; }
    .dropdown-item:hover { background: #f8fafc; }

    /* =========================================
        FIXED FLOATING AI CHAT CSS
       ========================================= */
    .chat-wrapper { position: fixed; bottom: 25px; right: 25px; z-index: 9999; display: flex; flex-direction: column; align-items: flex-end; }
    .chat-window { max-height: 420px; width: 340px; border-radius: 12px; background: white; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; margin-bottom: 15px; display: flex; flex-direction: column; overflow: hidden; }
    .chat-header { background: #3b82f6; color: white; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
    .chat-header button { background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; line-height: 1; }
    .chat-messages { padding: 10px; gap: 8px; overflow-y: auto; flex: 1; min-height: 200px; display: flex; flex-direction: column; }
    .msg-bubble { padding: 8px 12px; font-size: 0.9rem; border-radius: 8px; max-width: 85%; margin-bottom: 5px; }
    .msg-bubble.ai { background: #f1f5f9; color: #1e293b; align-self: flex-start; }
    .msg-bubble.user { background: #3b82f6; color: white; align-self: flex-end; }
    .chat-input-area { padding: 10px; border-top: 1px solid #e2e8f0; background: #f8fafc; display: flex; gap: 8px; }
    .chat-input-area input { flex: 1; height: 36px; padding: 0 15px; border: 1px solid #cbd5e1; border-radius: 20px; outline: none; font-size: 0.9rem; color: #000000 !important; }
    .chat-input-area input:focus { border-color: #3b82f6; }
    .chat-input-area button { padding: 0 15px; height: 36px; font-size: 0.9rem; background: #3b82f6; color: white; border: none; border-radius: 20px; font-weight: 600; cursor: pointer; }
    .chat-toggle-btn { padding: 12px 25px; border-radius: 50px; background: #3b82f6; color: white; font-weight: bold; border: none; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.15); }
  `}</style>
);

// =========================================
// --- STAR RATING COMPONENT ---
// =========================================
const StarRating = ({ docItem, currentUserId, onRate }) => {
  const ratingsMap = docItem.ratings || {};
  const ratingValues = Object.values(ratingsMap);
  const avgRating = ratingValues.length > 0
    ? (ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length)
    : 0;
  const myRating = currentUserId ? (ratingsMap[currentUserId] || 0) : 0;
  const [hoverVal, setHoverVal] = useState(0);

  return (
    <div className="star-row" onClick={(e) => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`star ${star <= (hoverVal || myRating) ? 'filled' : ''}`}
          onMouseEnter={() => setHoverVal(star)}
          onMouseLeave={() => setHoverVal(0)}
          onClick={() => onRate(docItem.id, star)}
        >★</span>
      ))}
      <span className="rating-count">
        {avgRating > 0 ? `${avgRating.toFixed(1)} (${ratingValues.length})` : 'No ratings yet'}
      </span>
    </div>
  );
};

function App() {
  const [view, setView] = useState('home'); 
  const [selectedCat, setSelectedCat] = useState(''); 
  const [selectedCourse, setSelectedCourse] = useState(''); 

  // --- AUTHENTICATION STATES ---
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState('login'); 
  const [authError, setAuthError] = useState('');

  // --- NEW: FORGOT PASSWORD STATES ---
  const [forgotStep, setForgotStep] = useState(0); 
  const [resetEmail, setResetEmail] = useState('');

  // --- FORM STATES ---
  const [dept, setDept] = useState('');
  const [course, setCourse] = useState(''); 
  const [stream, setStream] = useState(''); 
  const [year, setYear] = useState('');
  const [sem, setSem] = useState('');
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState(''); 
  const [selectedFile, setSelectedFile] = useState(null); 
  
  // --- BROWSE FILTER STATES ---
  const [browseStream, setBrowseStream] = useState('');
  const [fileResultsFilter, setFileResultsFilter] = useState('all');
  
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  // --- ADMIN & AI STATES ---
  const [adminPasscode, setAdminPasscode] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([{ role: 'ai', text: 'Hi! I am the NSU Archive Assistant. How can I help you with your studies?' }]);
  const API_KEY = "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";

  // --- NEW: DOWNLOAD / OFFLINE STATES ---
  const [downloadedIds, setDownloadedIds] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [offlineFiles, setOfflineFiles] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // --- DATA STRUCTURES ---
  const departments = [
    { id: 'Engineering and technology', icon: '⚙️', color: '#eef4ff' },
    { id: 'Computer Science/IT', icon: '💻', color: '#f0fff4' },
    { id: 'Management and Commerce', icon: '💼', color: '#fff9eb' },
    { id: 'Science Department', icon: '🔬', color: '#f8f0ff' },
    { id: 'Arts and humanities', icon: '🎨', color: '#fff0f0' },
    { id: 'Nursing and Health sciences', icon: '🏥', color: '#e0ffff' },
    { id: 'Pharmacy', icon: '💊', color: '#f5f5dc' },
    { id: 'Law department', icon: '⚖️', color: '#eaeaea' }
  ];

  const departmentCourseData = {
    "Engineering and technology": ["btech", "Mtech", "Diploma"], 
    "Computer Science/IT": ["Bca", "Mca"],
    "Management and Commerce": ["BBA", "MBA", "bcom"],
    "Science Department": ["bsc"],
    "Arts and humanities": ["BA"],
    "Nursing and Health sciences": ["ANM", "GNM", "Bsc Nursing"],
    "Pharmacy": ["D pharma", "b Pharma"],
    "Law department": ["LLB"]
  };

  const courseStreamData = {
    "btech": ["Computer Science", "Mechanical", "Civil", "Electrical", "ECE"],
    "Mtech": ["Computer Science", "Mechanical", "Civil", "Electrical", "ECE"],
    "Diploma": ["Computer Science", "Mechanical", "Civil", "Electrical", "Automobile"],
    "BBA": ["General", "Finance", "Marketing", "HR"],
    "MBA": ["General", "Finance", "Marketing", "HR"],
    "bsc": ["General", "Physics", "Chemistry", "Mathematics", "Biology", "Biotech"],
    "BA": ["General", "History", "Political Science", "English", "Economics"],
    "Bca": ["General"], "Mca": ["General"], "bcom": ["General"],
    "ANM": ["General"], "GNM": ["General"], "Bsc Nursing": ["General"],
    "D pharma": ["General"], "b Pharma": ["General"], "LLB": ["General"]
  };

  // --- NEW LOGIC: DYNAMIC YEAR & SEMESTER FILTERING ---
  const getAvailableYears = (courseName) => {
    const name = courseName?.toLowerCase();
    if (["btech", "bsc nursing", "b pharma", "llb"].includes(name)) {
      return ["1st Year", "2nd Year", "3rd Year", "4th Year"];
    }
    if (["diploma", "bca", "bba", "bsc", "ba", "bcom"].includes(name)) {
      return ["1st Year", "2nd Year", "3rd Year"];
    }
    return ["1st Year", "2nd Year"]; // MCA, MBA, MTech, D Pharma, ANM, GNM
  };

  const getAvailableSemesters = (yearName) => {
    if (yearName === "1st Year") return ["1", "2"];
    if (yearName === "2nd Year") return ["3", "4"];
    if (yearName === "3rd Year") return ["5", "6"];
    if (yearName === "4th Year") return ["7", "8"];
    return [];
  };

  const fetchVerified = async () => {
    if (!selectedCat || !selectedCourse || !browseStream || !sem || !year) return;
    
    const q = query(collection(db, "materials"), 
      where("dept", "==", selectedCat),
      where("course", "==", selectedCourse),
      where("stream", "==", browseStream), 
      where("year", "==", year),
      where("sem", "==", sem),
      where("status", "==", "verified")
    );
    const snap = await getDocs(q);
    setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchPending = async () => {
    const q = query(collection(db, "materials"), where("status", "==", "pending"));
    const snap = await getDocs(q);
    setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  // --- NEW: REFRESH THE LIST OF DOWNLOADED FILE IDs FROM INDEXEDDB ---
  const refreshOfflineList = async () => {
    try {
      const files = await getAllOfflineFiles();
      setOfflineFiles(files.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)));
      setDownloadedIds(files.map(f => f.id));
    } catch (e) {
      console.error("Failed to read offline storage", e);
    }
  };

  // --- USE-EFFECT ---
  useEffect(() => { 
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    if (view === 'browse') {
      setFileResultsFilter('all');
      fetchVerified(); 
    }
    
    if (view === 'admin') fetchPending();
    if (view === 'downloads') refreshOfflineList();

    return () => unsubscribe();
  }, [selectedCat, selectedCourse, browseStream, year, sem, view]);

  // --- LOAD DOWNLOADED IDS ONCE ON APP START (SO BUTTONS SHOW CORRECT STATE EVERYWHERE) ---
  useEffect(() => {
    refreshOfflineList();
  }, []);

  // --- AUTHENTICATION HANDLERS ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      }
      setAuthEmail(''); setAuthPassword('');
    } catch (error) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') setAuthError("Incorrect password.");
      else if (error.code === 'auth/user-not-found') setAuthError("Email not found. Please register.");
      else if (error.code === 'auth/email-already-in-use') setAuthError("This email is already registered.");
      else setAuthError("Error: " + error.message);
    }
  };

  // --- REAL FIREBASE PASSWORD RESET LOGIC ---
  const handleRealPasswordReset = async () => {
    setAuthError('');
    if (!resetEmail) return setAuthError("Please enter your registered email.");

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setForgotStep(2); // Move to the success message screen
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        setAuthError("You don't have an existing account with this email.");
      } else if (error.code === 'auth/invalid-email') {
        setAuthError("Please enter a valid email format.");
      } else {
        setAuthError("Error: " + error.message);
      }
    }
  };

  const handleLogout = () => {
    signOut(auth); setView('home'); 
  };

  // --- UPLOAD LOGIC ---
  const handleUpload = async () => {
    if (!selectedFile || !title || !dept || !course || !stream || !year || !sem || !docType) {
      return alert("Please fill ALL fields and select a file!");
    }
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("upload_preset", "ml_default"); 

      const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/ddqotov4h/upload`, {
        method: "POST", body: formData,
      });
      
      const cloudData = await cloudinaryRes.json();
      if (!cloudData.secure_url) throw new Error("Upload failed.");

      await addDoc(collection(db, "materials"), {
        title, dept, course, stream, year, sem, subject, docType,
        url: cloudData.secure_url,
        status: "pending", 
        timestamp: new Date(),
        ratings: {}
      });

      alert("File uploaded successfully! Awaiting Admin verification.");
      setView('home');
      setSelectedFile(null);
      setDept(''); setCourse(''); setStream(''); setYear(''); setSem(''); setSubject(''); setTitle(''); setDocType('');
    } catch (e) { 
      console.error(e); alert("Error: " + e.message); 
    }
    setUploading(false);
  };

  // --- ADMIN LOGIC ---
  const handleAdminLogin = () => {
    if (adminPasscode === 'NSU2026') { setView('admin'); setAdminPasscode(''); } 
    else { alert("Incorrect Passcode!"); }
  };

  const approveFile = async (id) => {
    await updateDoc(doc(db, "materials", id), { status: "verified" });
    fetchPending();
  };

  const deleteFile = async (id) => {
    await deleteDoc(doc(db, "materials", id));
    fetchPending();
  };

  // --- NEW: RATING LOGIC ---
  const handleRateDoc = async (docId, stars) => {
    if (!user) return alert("Please log in to rate this document.");
    try {
      const targetDoc = docs.find(d => d.id === docId);
      const existingRatings = targetDoc?.ratings || {};
      const updatedRatings = { ...existingRatings, [user.uid]: stars };

      await updateDoc(doc(db, "materials", docId), { ratings: updatedRatings });

      // Update local state immediately so the stars reflect the change without a refetch
      setDocs(prevDocs => prevDocs.map(d => d.id === docId ? { ...d, ratings: updatedRatings } : d));
    } catch (e) {
      console.error("Failed to save rating", e);
      alert("Could not save your rating. Please try again.");
    }
  };

  // --- NEW: DOWNLOAD FOR OFFLINE LOGIC (SAVES INSIDE THE APP, NOT THE PHONE GALLERY) ---
  const handleDownloadOffline = async (docItem) => {
    if (downloadedIds.includes(docItem.id)) return; // already saved
    setDownloadingId(docItem.id);
    try {
      const response = await fetch(docItem.url);
      if (!response.ok) throw new Error("Could not fetch the file.");
      const blob = await response.blob();
      await saveFileOffline(docItem, blob);
      setDownloadedIds(prev => [...prev, docItem.id]);
      await refreshOfflineList();
    } catch (e) {
      console.error("Offline download failed", e);
      alert("Could not save this file for offline use. Please check your connection and try again.");
    }
    setDownloadingId(null);
  };

  const handleOpenOfflineFile = (offlineDoc) => {
    const blobUrl = URL.createObjectURL(offlineDoc.blob);
    window.open(blobUrl, "_blank");
  };

  const handleRemoveOffline = async (id) => {
    await deleteOfflineFile(id);
    await refreshOfflineList();
  };

  // --- AI CHAT LOGIC ---
  const handleAI = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newMsgs = [...messages, { role: 'user', text: chatInput }];
    setMessages(newMsgs);
    setChatInput('');
    try {
      const res = await fetch(
  "https://api.groq.com/openai/v1/chat/completions",
  {
    method: "POST",
    headers: {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${API_KEY}`,
},
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "user",
          content: chatInput
        }
      ]
    })
  }
);

const data = await res.json();
      
    if (data.choices && data.choices.length > 0) {
  setMessages([
    ...newMsgs,
    {
      role: "ai",
      text: data.choices[0].message.content
    }
  ]);
} else {
  console.error("API Error from Groq:", data);
  setMessages([
    ...newMsgs,
    {
      role: "ai",
      text: "Sorry, I am currently unavailable."
    }
  ]);
}
    } catch (e) { 
      console.error(e);
      setMessages([...newMsgs, { role: 'ai', text: "Network error occurred." }]);
    }
  };

  // =========================================
  if (!user) {
    return (
      <div className="auth-page-dark">
        <AppStyles /> 
        <div className="auth-main-wrapper">
          <div className="auth-brand-logo">🎓 NSU<span>archive</span></div>
          {authError && <div className="auth-error-msg">{authError}</div>}
          
          {/* DEFAULT LOGIN/REGISTER */}
          {forgotStep === 0 && (
            <>
              <form onSubmit={handleAuth} className="auth-form">
                <input type="email" className="auth-input-dark" placeholder="Email address" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required />
                <input type="password" className="auth-input-dark" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required />
                <button type="submit" className="btn-login-blue">{authMode === 'login' ? 'Log in' : 'Sign up'}</button>
              </form>
              {authMode === 'login' && <div className="forgot-text" onClick={() => {setForgotStep(1); setAuthError('');}}>Forgotten password?</div>}
            </>
          )}

          {/* STEP 1: ENTER EMAIL FOR RESET */}
          {forgotStep === 1 && (
            <div className="auth-form">
              <p style={{textAlign: 'center', color: '#fff', margin: '0 0 5px 0', fontSize: '1.2rem', fontWeight: 'bold'}}>Reset Password</p>
              <p style={{textAlign: 'center', color: '#aaa', fontSize: '13px', margin: '0 0 15px 0'}}>Enter your registered email address.</p>
              
              <input type="email" className="auth-input-dark" placeholder="Registered email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
              <button className="btn-login-blue" onClick={handleRealPasswordReset}>Send Reset Link</button>
              <div className="forgot-text" onClick={() => {setForgotStep(0); setAuthError('');}}>Cancel</div>
            </div>
          )}

          {/* STEP 2: SUCCESS MESSAGE (FIREBASE SENDS A LINK) */}
          {forgotStep === 2 && (
            <div className="auth-form">
              <p style={{textAlign: 'center', color: '#fff', margin: '0 0 5px 0', fontSize: '1.2rem', fontWeight: 'bold'}}>Check Your Email</p>
              <div style={{background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '15px', borderRadius: '8px', margin: '15px 0'}}>
                <p style={{textAlign: 'center', color: '#10b981', fontSize: '14px', margin: '0 0 10px 0', fontWeight: 'bold'}}>
                  Success!
                </p>
                <p style={{textAlign: 'center', color: '#fff', fontSize: '13px', margin: '0', lineHeight: '1.5'}}>
                  A secure password reset link has been sent to <strong>{resetEmail}</strong>. Click the link in that email to create your new password, then come back here to log in.
                </p>
              </div>
              <button className="btn-login-blue" onClick={() => {setForgotStep(0); setResetEmail('');}}>Back to Login</button>
            </div>
          )}
          
        </div>
        {forgotStep === 0 && (
          <div className="auth-footer">
            <button className="btn-create-account" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}>
              {authMode === 'login' ? 'Create new account' : 'Back to Log in'}
            </button>
          </div>
        )}
      </div>
    );
  }

  const formatCourseName = (c) => c.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const getFilteredDocs = () => fileResultsFilter === 'all' ? docs : docs.filter(d => d.docType === fileResultsFilter);

  // =========================================
  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppStyles />

      <header className="main-header">
        <div className="logo" onClick={() => {setView('home'); setSelectedCat(''); setSelectedCourse(''); setBrowseStream(''); setYear(''); setSem('');}}>🎓 NSU<span>archive</span></div>
        <div className="menu-wrapper">
          <button className="btn-hamburger" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <span></span>
            <span></span>
            <span></span>
          </button>
          {isMenuOpen && (
            <>
              <div className="menu-overlay" onClick={() => setIsMenuOpen(false)}></div>
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={() => { setView('admin_login'); setIsMenuOpen(false); }}>
                  Admin Portal
                </button>
                <button className="dropdown-item" onClick={() => { setView('downloads'); setIsMenuOpen(false); }}>
                  My Downloads {offlineFiles.length > 0 && `(${offlineFiles.length})`}
                </button>
                <button className="dropdown-item" onClick={() => { handleLogout(); setIsMenuOpen(false); }}>
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* HOME PAGE */}
      {view === 'home' && (
        <main className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <section className="hero-text">
            <h2>NSU Study Portal</h2>
            <p>Access high-quality papers curated for NSU students.</p>
          </section>
          
          <div className="category-grid">
            {departments.map(d => (
              <div key={d.id} className="cat-card" style={{ backgroundColor: d.color }} onClick={() => { setSelectedCat(d.id); setView('courses_by_dept'); }}>
                <span className="cat-icon">{d.icon}</span>
                <h3 style={{fontSize: '1.1rem', margin: '10px 0 5px 0', color: '#1e293b', fontWeight: 'bold'}}>{d.id}</h3>
                <p style={{margin: 0, color: '#64748b', fontSize: '0.9rem'}}>Browse Courses</p>
              </div>
            ))}
          </div>
          
          <button className="btn-main-upload" style={{margin: '0 auto 20px', display: 'block', maxWidth: '400px'}} onClick={() => setView('upload')}>
            + Upload PYQ / Notes
          </button>

          {/* FAQ SECTION */}
          <div className="faq-section">
            <h3 style={{ textAlign: 'center', marginBottom: '30px', color: '#1e293b', fontSize: '1.5rem', fontWeight: '800' }}>About NSUarchive</h3>
            <div className="faq-grid">
              
              <div className="faq-card">
                <h4>What is NSUarchive?</h4>
                <p>NSUarchive is a centralized, student-driven digital library created to help NSU students easily find, access, and share academic resources like Previous Year Questions (PYQs) and study notes.</p>
              </div>
              
              <div className="faq-card">
                <h4>How does the upload process work?</h4>
                <p>To ensure high quality, every document uploaded by a student goes through a strict verification process. Administrators review the files before they become publicly available on the portal.</p>
              </div>
              
              <div className="faq-card">
                <h4>Can't find what you're looking for?</h4>
                <p>If we don't have the specific answer or document you need on the site, just ask the NSU AI Assistant! You can find the chat button right below to get instant help.</p>
              </div>

            </div>
          </div>
          
          {/* DEVELOPER FOOTER */}
          <div className="home-footer">
            Developed by Ibrahim, Sara and Ayesha
          </div>
        </main>
      )}

      {/* COURSES BY DEPARTMENT */}
      {view === 'courses_by_dept' && (
        <main className="container">
          <div className="portal-card">
            <button className="back-link" onClick={() => {setView('home'); setSelectedCat('');}}>← Back</button>
            <h2 className="portal-title">{selectedCat} - Courses</h2>
            <div className="course-list">
              {departmentCourseData[selectedCat] ? departmentCourseData[selectedCat].map(c => (
                <div key={c} className="course-row" onClick={() => { setSelectedCourse(c); setView('browse'); }}>
                  <div className="course-info"><strong>{formatCourseName(c)}</strong></div>
                  <button className="btn-browse-course">Select</button>
                </div>
              )) : <p className="empty-state">No courses available.</p>}
            </div>
          </div>
        </main>
      )}

      {/* ADMIN LOGIN SCREEN */}
      {view === 'admin_login' && (
        <main className="container">
          <div className="portal-card" style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
            <button className="back-link" onClick={() => setView('home')} style={{float: 'left'}}>← Back</button>
            <h2 className="portal-title" style={{clear: 'both'}}>Admin Verification</h2>
            <p style={{marginBottom: '20px', color: '#64748b'}}>Authorized personnel only.</p>
            <div className="input-group">
              <input type="password" placeholder="Enter Secret Passcode" required value={adminPasscode} onChange={(e) => setAdminPasscode(e.target.value)} style={{ textAlign: 'center', letterSpacing: '2px', fontWeight: 'bold' }} />
            </div>
            <button className="btn-submit-large" style={{width: '100%', marginTop: '15px'}} onClick={handleAdminLogin}>Unlock Portal</button>
          </div>
        </main>
      )}

      {/* BROWSE/FILTER PAGE */}
      {view === 'browse' && (
        <main className="container">
          <div className="portal-card">
            <button className="back-link" onClick={() => {setView('courses_by_dept'); setSelectedCourse(''); setBrowseStream(''); setSem(''); setYear('');}}>← Back</button>
            <h2 className="portal-title">{formatCourseName(selectedCourse)} Library</h2>
            
            <div className="filter-stack">
              <div className="input-group">
                <label>Stream / Branch</label>
                <select required value={browseStream} onChange={(e) => setBrowseStream(e.target.value)}>
                  <option value="">Select Stream...</option>
                  {courseStreamData[selectedCourse] && courseStreamData[selectedCourse].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Year</label>
                <select required value={year} onChange={(e) => {setYear(e.target.value); setSem('');}} disabled={!browseStream}>
                  <option value="">Select Year...</option>
                  {getAvailableYears(selectedCourse).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Semester</label>
                <select required value={sem} onChange={(e) => setSem(e.target.value)} disabled={!year}>
                  <option value="">Select Sem...</option>
                  {getAvailableSemesters(year).map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
            </div>
            
            <div className="doc-list" style={{border: 'none', background: '#f8fafc', padding: '15px', borderRadius: '8px', marginTop: '15px'}}>
              <p style={{color: '#64748b', fontSize: '0.9rem', marginBottom: '5px'}}>Documents available in this category:</p>
              <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                <span style={{fontSize: '2rem', fontWeight: 'bold', color: '#1e293b'}}>{browseStream && sem && year ? docs.length : '0'}</span>
                <span style={{fontSize: '1rem', color: '#64748b'}}>{docs.length === 1 ? 'file' : 'files'}</span>
              </div>
              
              {browseStream && sem && year && (
                <button className="btn-open" style={{marginTop: '10px', width: 'auto'}} disabled={docs.length === 0} onClick={() => setView('file_results')}>
                  Open
                </button>
              )}
            </div>
          </div>
        </main>
      )}

      {/* FINAL FILE RESULTS PAGE */}
      {view === 'file_results' && (
        <main className="container">
          <div className="portal-card">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
              <button className="back-link" onClick={() => setView('browse')}>← Back</button>
              
              <div className="onoff-filter-group">
                <button className={`btn-filter-pill ${fileResultsFilter === 'all' ? 'active' : ''}`} onClick={() => setFileResultsFilter('all')}>All</button>
                <button className={`btn-filter-pill ${fileResultsFilter === 'PYQ' ? 'active' : ''}`} onClick={() => setFileResultsFilter('PYQ')}>PYQs</button>
                <button className={`btn-filter-pill ${fileResultsFilter === 'Notes' ? 'active' : ''}`} onClick={() => setFileResultsFilter('Notes')}>Notes</button>
                <button className={`btn-filter-pill ${fileResultsFilter === 'Imp Ques' ? 'active' : ''}`} onClick={() => setFileResultsFilter('Imp Ques')}>Imp Ques</button>
              </div>
            </div>
            
            <h2 className="portal-title">{formatCourseName(selectedCourse)} - {browseStream} (Sem {sem})</h2>
            
            <div className="doc-list">
              {getFilteredDocs().map(d => {
                const isDownloaded = downloadedIds.includes(d.id);
                const isDownloadingThis = downloadingId === d.id;
                return (
                  <div key={d.id} className="doc-row" style={{flexDirection: 'column', alignItems: 'stretch', gap: '10px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px'}}>
                      <div className="doc-info">
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
                          <strong>{d.title}</strong>
                          {d.docType && <span className={`doc-tag ${d.docType.toLowerCase().replace(/\s/g, '')}`}>{d.docType}</span>}
                          {isDownloaded && <span className="offline-badge">Saved offline</span>}
                        </div>
                        <p>{d.subject}</p>
                        <StarRating docItem={d} currentUserId={user?.uid} onRate={handleRateDoc} />
                      </div>
                    </div>
                    <div className="doc-actions-row">
                      <button className="btn-open" onClick={() => window.open(d.url)}>Open PDF</button>
                      <button
                        className={`btn-download ${isDownloaded ? 'btn-downloaded' : ''}`}
                        disabled={isDownloadingThis || isDownloaded}
                        onClick={() => handleDownloadOffline(d)}
                      >
                        {isDownloaded ? '✓ Downloaded' : isDownloadingThis ? 'Saving...' : '⬇️ Download'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {getFilteredDocs().length === 0 && <p className="empty-state">No verified files found for this selection.</p>}
            </div>
          </div>
        </main>
      )}

      {/* NEW: MY DOWNLOADS PAGE (OFFLINE, NO INTERNET NEEDED) */}
      {view === 'downloads' && (
        <main className="container">
          <div className="portal-card">
            <button className="back-link" onClick={() => setView('home')}>← Back</button>
            <h2 className="portal-title">My Downloads</h2>
            <p style={{textAlign: 'center', color: '#64748b', marginTop: '-5px', marginBottom: '15px', fontSize: '0.9rem'}}>
              Saved on this device. Open these anytime, even without internet.
            </p>
            {offlineFiles.length === 0 ? (
              <p className="empty-state">You haven't downloaded any files yet. Tap "Download" on any document to save it here.</p>
            ) : (
              offlineFiles.map(f => (
                <div key={f.id} className="offline-doc-row">
                  <div className="offline-doc-info">
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <strong style={{color: '#000'}}>{f.title}</strong>
                      {f.docType && <span className={`doc-tag ${f.docType.toLowerCase().replace(/\s/g, '')}`}>{f.docType}</span>}
                    </div>
                    <p>{f.subject} {f.course ? `• ${formatCourseName(f.course)}` : ''} {f.sem ? `• Sem ${f.sem}` : ''}</p>
                  </div>
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button className="btn-open" onClick={() => handleOpenOfflineFile(f)}>Open</button>
                    <button className="btn-remove-offline" onClick={() => handleRemoveOffline(f.id)}>Remove</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      )}

      {/* UPLOAD PAGE */}
      {view === 'upload' && (
        <main className="container">
          <div className="portal-card contribution-form">
            <h2 className="portal-title">Contribution Portal</h2>
            <div className="form-stack">
              <div className="input-group">
                <label>Department</label>
                <select required onChange={(e) => {setDept(e.target.value); setCourse(''); setStream(''); setYear(''); setSem('');}}>
                  <option value="">Select...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.id}</option>)}
                </select>
              </div>
              <div className="row-group">
                <div className="input-group">
                  <label>Course</label>
                  <select required onChange={(e) => {setCourse(e.target.value); setStream(''); setYear(''); setSem('');}} disabled={!dept}>
                    <option value="">Select Course...</option>
                    {dept && departmentCourseData[dept] && departmentCourseData[dept].map(c => <option key={c} value={c}>{formatCourseName(c)}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Stream</label>
                  <select required onChange={(e) => setStream(e.target.value)} disabled={!course}>
                    <option value="">Select Stream...</option>
                    {course && courseStreamData[course] && courseStreamData[course].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="row-group">
                <div className="input-group">
                  <label>Year</label>
                  <select required disabled={!course} onChange={(e) => {setYear(e.target.value); setSem('');}}>
                    <option value="">Year...</option>
                    {getAvailableYears(course).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Semester</label>
                  <select required disabled={!year} onChange={(e) => setSem(e.target.value)}>
                    <option value="">Sem...</option>
                    {getAvailableSemesters(year).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              
              <input type="text" placeholder="Subject Name" required onChange={(e) => setSubject(e.target.value)} />
              <input type="text" placeholder="Title (e.g. EndSem 2024)" required onChange={(e) => setTitle(e.target.value)} />

              <div className="input-group">
                <label>Document Type</label>
                <select required onChange={(e) => setDocType(e.target.value)}>
                  <option value="">Select...</option>
                  <option value="PYQ">Previous Year Question (PYQ)</option>
                  <option value="Notes">Study Notes</option>
                  <option value="Imp Ques">Important Questions (Imp Ques)</option>
                </select>
              </div>
              
              <div className="file-input-wrapper">
                <label>Select Document (PDF/Image)</label>
                <input type="file" required className="modern-file-input" onChange={(e) => setSelectedFile(e.target.files[0])} />
                <p className="file-info" style={{color: '#000000'}}>{selectedFile ? `Selected: ${selectedFile.name}` : "No file chosen"}</p>
              </div>
            </div>
            <div className="form-actions" style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
              <button className="btn-cancel" style={{padding: '12px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: '500', cursor: 'pointer', color: '#000'}} onClick={() => setView('home')}>Cancel</button>
              <button className="btn-submit-large" onClick={handleUpload} disabled={uploading}>
                {uploading ? "Uploading to Cloud..." : "Send for Approval"}
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ADMIN PORTAL */}
      {view === 'admin' && (
        <main className="container">
          <div className="portal-card">
            <button className="back-link" onClick={() => setView('home')}>← Exit Admin</button>
            <h2 className="portal-title">Review Pending Files</h2>
            {docs.map(d => (
              <div key={d.id} className="admin-row" style={{background: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e2e8f0'}}>
                <div className="admin-info">
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px'}}>
                    <strong style={{fontSize: '1.1rem', color: '#000'}}>{d.title}</strong>
                    {d.docType && <span style={{background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'}}>{d.docType}</span>}
                  </div>
                  <span style={{color: '#64748b', fontSize: '0.9rem'}}>{d.course && formatCourseName(d.course)} | {d.stream} | Sem {d.sem}</span>
                </div>
                <div className="admin-btns" style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                  <button className="btn-view" style={{padding: '6px 12px', background: '#3b82f6', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer'}} onClick={() => window.open(d.url)}>Open</button>
                  <button className="btn-approve" style={{padding: '6px 12px', background: '#10b981', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer'}} onClick={() => approveFile(d.id)}>Approve</button>
                  <button className="btn-delete" style={{padding: '6px 12px', background: '#ef4444', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer'}} onClick={() => deleteFile(d.id)}>Delete</button>
                </div>
              </div>
            ))}
            {docs.length === 0 && <p className="empty-state">Everything is up to date.</p>}
          </div>
        </main>
      )}

      {/* ORIGINAL FLOATING AI ASSISTANT (FIXED OPEN/CLOSE) */}
      <div className="chat-wrapper">
        {isChatOpen && (
          <div className="chat-window">
            <div className="chat-header">
              <span>NSU AI Assistant</span>
              <button onClick={() => setIsChatOpen(false)}>×</button>
            </div>
            <div className="chat-messages">
              {messages.map((m, i) => (
                <div key={i} className={`msg-bubble ${m.role}`}>{m.text}</div>
              ))}
            </div>
            <form className="chat-input-area" onSubmit={handleAI}>
              <input type="text" placeholder="Ask anything..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
              <button type="submit">Send</button>
            </form>
          </div>
        )}
        <button className="chat-toggle-btn" onClick={() => setIsChatOpen(!isChatOpen)}>
          {isChatOpen ? 'Close AI ✖' : '✨ Ask AI'}
        </button>
      </div>

    </div>
  );
}

export default App;
