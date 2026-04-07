import React, { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, signInWithGoogle } from './firebase';
import { Student, HabitRecord } from './types';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isSharedMode, setIsSharedMode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Teacher password auth
  const [isFirebaseAuthenticated, setIsFirebaseAuthenticated] = useState(false); // Firebase auth
  const [schoolEmail, setSchoolEmail] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(true);
  const [approvedSchoolsList, setApprovedSchoolsList] = useState<any[]>([]);
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const OWNER_EMAIL = 'lelalusiana215@gmail.com';
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Report Configuration
  const [schoolName, setSchoolName] = useState('NAMA SEKOLAH ANDA');
  const [schoolAddress, setSchoolAddress] = useState('Alamat Lengkap Sekolah Anda');
  const [principalName, setPrincipalName] = useState('Nama Kepala Sekolah, S.Pd.');
  const [principalNip, setPrincipalNip] = useState('');
  const [teacherName, setTeacherName] = useState('Nama Guru Kelas, S.Pd.');
  const [teacherNip, setTeacherNip] = useState('');
  const [showReportPreview, setShowReportPreview] = useState(false);

  const [students, setStudents] = useState<Student[]>([]);
  const [habitRecords, setHabitRecords] = useState<HabitRecord[]>([]);

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isErrorToast, setIsErrorToast] = useState(false);

  // Form State
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Report State
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSemester, setSelectedSemester] = useState(new Date().getMonth() < 6 ? 2 : 1);
  const [selectedSemesterYear, setSelectedSemesterYear] = useState(new Date().getFullYear());
  const [selectedReportClass, setSelectedReportClass] = useState('');

  useEffect(() => {
    // Check if URL has ?view=form
    const params = new URLSearchParams(window.location.search);
    const isShared = params.get('view') === 'form';
    if (isShared) {
      setIsSharedMode(true);
      setCurrentPage('form');
      const schoolParam = params.get('school');
      if (schoolParam) {
        setSchoolEmail(schoolParam);
      }
    }

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setIsFirebaseAuthenticated(true);
        const userEmail = user.email || '';
        
        if (isShared) {
          setCheckingApproval(false);
        } else {
          if (userEmail === OWNER_EMAIL) {
            setIsOwner(true);
            setIsSchoolAdmin(true);
            setIsApproved(true);
            setSchoolEmail(userEmail);
            setCheckingApproval(false);
          } else {
            setIsOwner(false);
            try {
              const docRef = doc(db, 'approvedSchools', userEmail);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                setIsSchoolAdmin(true);
                setIsApproved(true);
                setSchoolEmail(userEmail);
              } else {
                const teacherDocRef = doc(db, 'teachers', userEmail);
                const teacherDocSnap = await getDoc(teacherDocRef);
                if (teacherDocSnap.exists()) {
                  setIsSchoolAdmin(false);
                  setIsApproved(true);
                  setSchoolEmail(teacherDocSnap.data().schoolEmail);
                } else {
                  setIsSchoolAdmin(false);
                  setIsApproved(false);
                }
              }
            } catch (error) {
              console.error("Error checking approval:", error);
              setIsSchoolAdmin(false);
              setIsApproved(false);
            }
            setCheckingApproval(false);
          }
        }
      } else {
        setIsFirebaseAuthenticated(false);
        setIsOwner(false);
        setIsSchoolAdmin(false);
        setIsApproved(false);
        if (!isShared) {
          setSchoolEmail('');
        }
        setCheckingApproval(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (schoolEmail && (isSharedMode || (isFirebaseAuthenticated && isApproved))) {
      const studentsRef = collection(db, 'students');
      const qStudents = query(studentsRef, where('schoolEmail', '==', schoolEmail));
      const unsubscribeStudents = onSnapshot(qStudents, (snapshot) => {
        const studentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
        setStudents(studentsData);
      }, (error) => {
        console.error("Error fetching students:", error);
      });

      const habitsRef = collection(db, 'habitRecords');
      const qHabits = query(habitsRef, where('schoolEmail', '==', schoolEmail));
      const unsubscribeHabits = onSnapshot(qHabits, (snapshot) => {
        const habitsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HabitRecord));
        setHabitRecords(habitsData);
      }, (error) => {
        console.error("Error fetching habit records:", error);
      });

      return () => {
        unsubscribeStudents();
        unsubscribeHabits();
      };
    }
  }, [isFirebaseAuthenticated, schoolEmail, isApproved, isSharedMode]);

  useEffect(() => {
    if (isOwner) {
      const unsubscribe = onSnapshot(collection(db, 'approvedSchools'), (snapshot) => {
        setApprovedSchoolsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.error("Error fetching approved schools:", error);
      });
      return () => unsubscribe();
    }
  }, [isOwner]);

  useEffect(() => {
    if (isSchoolAdmin && schoolEmail) {
      const qTeachers = query(collection(db, 'teachers'), where('schoolEmail', '==', schoolEmail));
      const unsubscribe = onSnapshot(qTeachers, (snapshot) => {
        setTeachersList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.error("Error fetching teachers:", error);
      });
      return () => unsubscribe();
    }
  }, [isSchoolAdmin, schoolEmail]);

  const displayToast = (message: string, isError = false) => {
    setToastMessage(message);
    setIsErrorToast(isError);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}?view=form&school=${schoolEmail}`;
    navigator.clipboard.writeText(link).then(() => {
      displayToast('✅ Link formulir berhasil disalin!');
    }).catch(() => {
      displayToast('Gagal menyalin link.', true);
    });
  };

  const handleAddApprovedSchool = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('school-email') as string;
    if (email.trim()) {
      try {
        await setDoc(doc(db, 'approvedSchools', email.trim().toLowerCase()), {
          email: email.trim().toLowerCase(),
          addedAt: new Date().toISOString()
        });
        displayToast('✅ Email sekolah berhasil disetujui!');
        (e.target as HTMLFormElement).reset();
      } catch (error) {
        displayToast('Gagal menyetujui email.', true);
      }
    }
  };

  const handleRemoveApprovedSchool = async (email: string) => {
    if (window.confirm(`Hapus akses untuk ${email}?`)) {
      try {
        await deleteDoc(doc(db, 'approvedSchools', email));
        displayToast('✅ Akses sekolah dicabut!');
      } catch (error) {
        displayToast('Gagal mencabut akses.', true);
      }
    }
  };

  const handleAddTeacher = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('teacher-email') as string;
    const name = formData.get('teacher-name') as string;
    
    if (email.trim() && name.trim()) {
      try {
        await setDoc(doc(db, 'teachers', email.trim().toLowerCase()), {
          email: email.trim().toLowerCase(),
          name: name.trim(),
          schoolEmail: schoolEmail,
          addedAt: new Date().toISOString()
        });
        displayToast('✅ Akun guru berhasil ditambahkan!');
        (e.target as HTMLFormElement).reset();
      } catch (error) {
        displayToast('Gagal menambahkan guru.', true);
      }
    }
  };

  const handleRemoveTeacher = async (email: string) => {
    if (window.confirm(`Hapus akses guru untuk ${email}?`)) {
      try {
        await deleteDoc(doc(db, 'teachers', email));
        displayToast('✅ Akses guru dicabut!');
      } catch (error) {
        displayToast('Gagal mencabut akses guru.', true);
      }
    }
  };


  const handlePasswordSubmit = () => {
    if (passwordInput === 'guru123') {
      setIsAuthenticated(true);
      setShowPasswordModal(false);
      setPasswordError(false);
      setPasswordInput('');
      setCurrentPage(passwordTarget);
    } else {
      setPasswordError(true);
    }
  };

  const openProtectedPage = (page: string) => {
    if (isAuthenticated) {
      setCurrentPage(page);
    } else {
      setPasswordTarget(page);
      setShowPasswordModal(true);
    }
  };

  const calculateScore = (data: any) => {
    let score = 0;
    if (data.wake_time) {
      const time = data.wake_time.split(':');
      const minutes = parseInt(time[0]) * 60 + parseInt(time[1]);
      score += minutes <= 330 ? 100 : 50;
    }
    const prayerCount = [
      data.prayer_subuh, data.prayer_dhuhur, data.prayer_ashar,
      data.prayer_maghrib, data.prayer_isya, data.dta
    ].filter(Boolean).length;
    score += (prayerCount / 6) * 100;
    score += data.exercise ? 100 : 0;
    score += data.healthy_food ? 100 : 0;
    if (data.study_duration) {
      const duration = parseInt(data.study_duration);
      score += Math.min(100, (duration / 120) * 100);
    }
    score += data.social_activity ? 100 : 0;
    if (data.sleep_time) {
      const time = data.sleep_time.split(':');
      const minutes = parseInt(time[0]) * 60 + parseInt(time[1]);
      if (minutes <= 1260) score += 100;
      else if (minutes <= 1290) score += 70;
      else score += 40;
    }
    return Math.round(score / 7);
  };

  const getCategory = (score: number) => {
    if (score >= 71) return 'Sudah Terbiasa';
    if (score >= 41) return 'Mulai Terbiasa';
    return 'Belum Terbiasa';
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const isDuplicate = habitRecords.some(item => 
      item.student_name === selectedStudent && 
      item.class === selectedClass && 
      item.date === selectedDate
    );

    if (isDuplicate) {
      displayToast(`${selectedStudent} sudah mengisi form untuk tanggal ${selectedDate}!`, true);
      return;
    }

    const data = {
      student_name: selectedStudent,
      class: selectedClass,
      date: selectedDate,
      wake_time: formData.get('wake-time') as string,
      prayer_subuh: formData.get('prayer-subuh') === 'on',
      prayer_dhuhur: formData.get('prayer-dhuhur') === 'on',
      prayer_ashar: formData.get('prayer-ashar') === 'on',
      prayer_maghrib: formData.get('prayer-maghrib') === 'on',
      prayer_isya: formData.get('prayer-isya') === 'on',
      dta: formData.get('dta') === 'on',
      exercise: formData.get('exercise') === 'yes',
      exercise_type: formData.get('exercise-type') as string,
      healthy_food: formData.get('food') === 'yes',
      food_menu: formData.get('food-menu') as string,
      study_duration: formData.get('study-duration') as string,
      social_activity: formData.get('social-activity') as string,
      sleep_time: formData.get('sleep-time') as string,
    };

    const score = calculateScore(data);
    const finalData = { ...data, total_score: score, category: getCategory(score), schoolEmail };

    try {
      await addDoc(collection(db, 'habitRecords'), finalData);
      displayToast('✅ Data berhasil disimpan!');
      (e.target as HTMLFormElement).reset();
      setSelectedClass('');
      setSelectedStudent('');
      if (isSharedMode) {
        setFormSubmitted(true);
      }
    } catch (error) {
      displayToast('Gagal menyimpan data.', true);
      console.error(error);
    }
  };

  const handleAddStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const studentName = formData.get('new-student-name') as string;
    const studentClass = formData.get('new-student-class') as string;

    const isDuplicate = students.some(s => s.student_name.toLowerCase() === studentName.toLowerCase() && s.class === studentClass);
    if (isDuplicate) {
      displayToast(`Siswa "${studentName}" sudah ada di ${studentClass}!`, true);
      return;
    }

    try {
      await addDoc(collection(db, 'students'), { student_name: studentName, class: studentClass, schoolEmail });
      displayToast('✅ Siswa berhasil ditambahkan!');
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      displayToast('Gagal menambahkan siswa.', true);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus siswa ini?')) {
      try {
        await deleteDoc(doc(db, 'students', id));
        displayToast('✅ Siswa berhasil dihapus!');
      } catch (error) {
        displayToast('Gagal menghapus siswa.', true);
      }
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        let successCount = 0;
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (row.length >= 2) {
            const studentClass = String(row[0]).trim();
            const studentName = String(row[1]).trim();
            
            if (studentClass && studentName && !students.some(s => s.student_name === studentName && s.class === studentClass)) {
              await addDoc(collection(db, 'students'), { student_name: studentName, class: studentClass, schoolEmail });
              successCount++;
            }
          }
        }
        displayToast(`✅ Berhasil mengimpor ${successCount} siswa!`);
      } catch (error) {
        displayToast('Gagal mengimpor file Excel.', true);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      ['Kelas', 'Nama Siswa'],
      ['Kelas 1', 'Budi Santoso'],
      ['Kelas 2', 'Siti Aminah'],
      ['Kelas 3', 'Andi Darmawan']
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
    XLSX.writeFile(wb, "Template_Data_Siswa.xlsx");
  };

  const renderHomePage = () => (
    <div className="bg-white rounded-3xl shadow-2xl p-8">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm font-bold text-gray-500 bg-gray-100 px-4 py-2 rounded-xl">
          🏫 {schoolEmail}
        </div>
        <div className="flex gap-2">
          {isAuthenticated && (
            <button onClick={() => setIsAuthenticated(false)} className="bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-xl font-bold text-sm">
              🔒 Kunci Mode Guru
            </button>
          )}
          <button onClick={() => auth.signOut()} className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-xl font-bold text-sm">
            🚪 Keluar Akun
          </button>
        </div>
      </div>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-purple-700 mb-2">SIMOCI3-G7KAIH</h1>
        <p className="text-xl text-gray-600">Mari Membangun Kebiasaan Baik Setiap Hari!</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <button onClick={() => setCurrentPage('form')} className="btn-menu bg-green-500 hover:bg-green-600 text-white py-6 px-8 rounded-2xl text-xl font-bold shadow-lg w-full">
            🎯 Form Isian Siswa
          </button>
          <button onClick={handleCopyLink} className="bg-green-100 hover:bg-green-200 text-green-800 py-2 px-4 rounded-xl font-bold shadow-sm text-sm flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            Bagikan Link Form
          </button>
        </div>
        <button onClick={() => openProtectedPage('daily')} className="btn-menu bg-blue-500 hover:bg-blue-600 text-white py-6 px-8 rounded-2xl text-xl font-bold shadow-lg">
          📊 Rekap Harian 🔒
        </button>
        <button onClick={() => openProtectedPage('monthly')} className="btn-menu bg-yellow-500 hover:bg-yellow-600 text-white py-6 px-8 rounded-2xl text-xl font-bold shadow-lg">
          📈 Rekap Bulanan 🔒
        </button>
        <button onClick={() => openProtectedPage('semester')} className="btn-menu bg-purple-500 hover:bg-purple-600 text-white py-6 px-8 rounded-2xl text-xl font-bold shadow-lg">
          🏆 Rekap Semester 🔒
        </button>
        <button onClick={() => openProtectedPage('student-management')} className="btn-menu bg-red-500 hover:bg-red-600 text-white py-6 px-8 rounded-2xl text-xl font-bold shadow-lg col-span-1 md:col-span-2">
          👥 Kelola Data Siswa 🔒
        </button>
        {isSchoolAdmin && (
          <button onClick={() => openProtectedPage('teacher-management')} className="btn-menu bg-teal-500 hover:bg-teal-600 text-white py-6 px-8 rounded-2xl text-xl font-bold shadow-lg col-span-1 md:col-span-2 mt-2">
            👨‍🏫 Kelola Data Guru 🔒
          </button>
        )}
        {isOwner && (
          <button onClick={() => setCurrentPage('admin')} className="btn-menu bg-indigo-500 hover:bg-indigo-600 text-white py-6 px-8 rounded-2xl text-xl font-bold shadow-lg col-span-1 md:col-span-2 mt-2">
            👑 Kelola Akses Sekolah
          </button>
        )}
      </div>
    </div>
  );

  const renderFormPage = () => {
    if (formSubmitted && isSharedMode) {
      return (
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-green-600 mb-4">Terima Kasih!</h2>
          <p className="text-xl text-gray-600 mb-8">Data kebiasaan harian berhasil disimpan.</p>
          <button onClick={() => setFormSubmitted(false)} className="bg-purple-500 hover:bg-purple-600 text-white py-3 px-8 rounded-xl font-bold">
            Isi Form Lagi
          </button>
        </div>
      );
    }

    const classStudents = students.filter(s => s.class === selectedClass).sort((a,b) => a.student_name.localeCompare(b.student_name));
    const submittedOnDate = habitRecords.filter(item => item.date === selectedDate && item.class === selectedClass).map(item => item.student_name);

    return (
      <div className="bg-white rounded-3xl shadow-2xl p-8">
        {!isSharedMode && (
          <button onClick={() => setCurrentPage('home')} className="mb-6 bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-xl">
            ← Kembali ke Beranda
          </button>
        )}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-purple-700">Form Isian Siswa</h2>
        </div>
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-4">Data Siswa</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Pilih Kelas:</label>
                <select value={selectedClass} onChange={(e) => {setSelectedClass(e.target.value); setSelectedStudent('');}} required className="w-full p-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none">
                  <option value="">-- Pilih Kelas --</option>
                  {['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Nama Siswa:</label>
                <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} required disabled={!selectedClass} className="w-full p-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none">
                  <option value="">-- Pilih nama siswa --</option>
                  {classStudents.map(s => (
                    <option key={s.id} value={s.student_name} disabled={submittedOnDate.includes(s.student_name)}>
                      {s.student_name} {submittedOnDate.includes(s.student_name) ? '✓ (Sudah mengisi)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Tanggal:</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} required className="w-full p-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none" />
              </div>
            </div>
          </div>
          
          <div className="card-habit bg-yellow-100 p-6 rounded-2xl shadow-md">
            <div className="flex items-center mb-4"><span className="text-4xl mr-3">⏰</span><h3 className="text-xl font-bold">1. Bangun Pagi</h3></div>
            <select name="wake-time" className="w-full p-3 border-2 border-yellow-300 rounded-xl focus:border-yellow-500 focus:outline-none">
              <option value="">Pilih waktu bangun</option>
              {['04:00','04:15','04:30','04:45','05:00','05:15','05:30','05:45','06:00'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="card-habit bg-green-100 p-6 rounded-2xl shadow-md">
            <div className="flex items-center mb-4"><span className="text-4xl mr-3">🕌</span><h3 className="text-xl font-bold">2. Beribadah</h3></div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {['subuh', 'dhuhur', 'ashar', 'maghrib', 'isya'].map(p => (
                <label key={p} className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" name={`prayer-${p}`} className="w-5 h-5" /><span>Shalat {p.charAt(0).toUpperCase() + p.slice(1)}</span>
                </label>
              ))}
              <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" name="dta" className="w-5 h-5" /><span>Pengajian DTA</span></label>
            </div>
          </div>

          <div className="card-habit bg-blue-100 p-6 rounded-2xl shadow-md">
            <div className="flex items-center mb-4"><span className="text-4xl mr-3">⚽</span><h3 className="text-xl font-bold">3. Olahraga</h3></div>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center space-x-2 cursor-pointer"><input type="radio" name="exercise" value="yes" className="w-5 h-5" /><span>Ya</span></label>
              <label className="flex items-center space-x-2 cursor-pointer"><input type="radio" name="exercise" value="no" className="w-5 h-5" defaultChecked /><span>Tidak</span></label>
            </div>
            <input type="text" name="exercise-type" placeholder="Jenis olahraga" className="w-full p-3 border-2 border-blue-300 rounded-xl focus:border-blue-500 focus:outline-none" />
          </div>

          <div className="card-habit bg-orange-100 p-6 rounded-2xl shadow-md">
            <div className="flex items-center mb-4"><span className="text-4xl mr-3">🥗</span><h3 className="text-xl font-bold">4. Makan Bergizi</h3></div>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center space-x-2 cursor-pointer"><input type="radio" name="food" value="yes" className="w-5 h-5" /><span>Ya</span></label>
              <label className="flex items-center space-x-2 cursor-pointer"><input type="radio" name="food" value="no" className="w-5 h-5" defaultChecked /><span>Tidak</span></label>
            </div>
            <input type="text" name="food-menu" placeholder="Menu makanan" className="w-full p-3 border-2 border-orange-300 rounded-xl focus:border-orange-500 focus:outline-none" />
          </div>

          <div className="card-habit bg-purple-100 p-6 rounded-2xl shadow-md">
            <div className="flex items-center mb-4"><span className="text-4xl mr-3">📚</span><h3 className="text-xl font-bold">5. Gemar Belajar</h3></div>
            <select name="study-duration" className="w-full p-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none">
              <option value="">Pilih lama belajar</option>
              {['0','15','30','45','60','75','90','105','120'].map(t => <option key={t} value={t}>{t} menit</option>)}
            </select>
          </div>

          <div className="card-habit bg-pink-100 p-6 rounded-2xl shadow-md">
            <div className="flex items-center mb-4"><span className="text-4xl mr-3">🤝</span><h3 className="text-xl font-bold">6. Bermasyarakat</h3></div>
            <textarea name="social-activity" placeholder="Tuliskan kegiatan bermasyarakat yang kamu lakukan hari ini." className="w-full p-3 border-2 border-pink-300 rounded-xl focus:border-pink-500 focus:outline-none" rows={3}></textarea>
          </div>

          <div className="card-habit bg-indigo-100 p-6 rounded-2xl shadow-md">
            <div className="flex items-center mb-4"><span className="text-4xl mr-3">😴</span><h3 className="text-xl font-bold">7. Tidur Cepat</h3></div>
            <select name="sleep-time" className="w-full p-3 border-2 border-indigo-300 rounded-xl focus:border-indigo-500 focus:outline-none">
              <option value="">Pilih waktu tidur</option>
              {['19:30','20:00','20:30','21:00','21:30','22:00'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex gap-4 justify-center">
            <button type="submit" className="bg-green-500 hover:bg-green-600 text-white py-4 px-12 rounded-xl text-xl font-bold shadow-lg">💾 Simpan Data</button>
          </div>
        </form>
      </div>
    );
  };

  const renderStudentManagementPage = () => {
    return (
      <div className="bg-white rounded-3xl shadow-2xl p-8">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setCurrentPage('home')} className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-xl">← Kembali ke Beranda</button>
        </div>
        <h2 className="text-3xl font-bold text-center text-red-700 mb-6">👥 Kelola Data Siswa</h2>
        
        <div className="bg-gradient-to-r from-red-100 to-pink-100 p-6 rounded-2xl mb-6">
          <h3 className="text-xl font-bold mb-4">➕ Tambah Siswa Baru</h3>
          <form onSubmit={handleAddStudent} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Kelas:</label>
                <select name="new-student-class" required className="w-full p-3 border-2 border-red-300 rounded-xl focus:border-red-500 focus:outline-none">
                  <option value="">-- Pilih Kelas --</option>
                  {['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Nama Siswa:</label>
                <input type="text" name="new-student-name" required placeholder="Masukkan nama lengkap siswa" className="w-full p-3 border-2 border-red-300 rounded-xl focus:border-red-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <button type="submit" className="bg-green-500 hover:bg-green-600 text-white py-3 px-8 rounded-xl font-bold">➕ Tambah Siswa</button>
              <label className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-8 rounded-xl font-bold cursor-pointer inline-flex items-center gap-2">
                📁 Impor dari Excel
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" />
              </label>
              <button type="button" onClick={handleDownloadTemplate} className="bg-gray-500 hover:bg-gray-600 text-white py-3 px-8 rounded-xl font-bold inline-flex items-center gap-2">
                📥 Download Template Excel
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          {['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'].map(className => {
            const classStudents = students.filter(s => s.class === className).sort((a,b) => a.student_name.localeCompare(b.student_name));
            if (classStudents.length === 0) return null;
            return (
              <div key={className} className="bg-gray-50 rounded-2xl p-6">
                <h3 className="text-xl font-bold mb-4 text-red-700">{className} ({classStudents.length} siswa)</h3>
                <div className="space-y-2">
                  {classStudents.map(student => (
                    <div key={student.id} className="student-item bg-white p-4 rounded-xl flex justify-between items-center border-2 border-gray-200">
                      <div>
                        <p className="font-bold">{student.student_name}</p>
                        <p className="text-sm text-gray-500">{student.class}</p>
                      </div>
                      <button onClick={() => handleDeleteStudent(student.id)} className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-xl text-sm font-bold">🗑️ Hapus</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDailyReportPage = () => {
    const filteredRecords = habitRecords.filter(record => {
      if (selectedReportClass && record.class !== selectedReportClass) return false;
      return true;
    });

    return (
      <div className="bg-white rounded-3xl shadow-2xl p-8">
        <button onClick={() => setCurrentPage('home')} className="mb-6 bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-xl">← Kembali ke Beranda</button>
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-blue-700">📊 Rekap Harian</h2>
        </div>
        
        <div className="flex justify-center mb-6">
          <select 
            value={selectedReportClass} 
            onChange={(e) => setSelectedReportClass(e.target.value)}
            className="p-3 border-2 border-blue-300 rounded-xl focus:border-blue-500 focus:outline-none"
          >
            <option value="">Semua Kelas</option>
            {['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th className="p-3 border">Nama</th>
                <th className="p-3 border">Kelas</th>
                <th className="p-3 border">Tanggal</th>
                <th className="p-3 border">Skor %</th>
                <th className="p-3 border">Kategori</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="p-3 border">{record.student_name}</td>
                  <td className="p-3 border text-center">{record.class}</td>
                  <td className="p-3 border text-center">{record.date}</td>
                  <td className="p-3 border text-center font-bold">{record.total_score}%</td>
                  <td className="p-3 border text-center">{record.category}</td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">Tidak ada data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderMonthlyReportPage = () => {
    const filteredRecords = habitRecords.filter(record => {
      const recordDate = new Date(record.date);
      if (selectedReportClass && record.class !== selectedReportClass) return false;
      return recordDate.getMonth() + 1 === selectedMonth && recordDate.getFullYear() === selectedYear;
    });

    const filteredStudents = selectedReportClass ? students.filter(s => s.class === selectedReportClass) : students;

    const studentAverages = filteredStudents.map(student => {
      const studentRecords = filteredRecords.filter(r => r.student_name === student.student_name && r.class === student.class);
      if (studentRecords.length === 0) return null;
      
      const totalScore = studentRecords.reduce((sum, record) => sum + record.total_score, 0);
      const averageScore = Math.round(totalScore / studentRecords.length);
      
      return {
        ...student,
        averageScore,
        category: getCategory(averageScore),
        daysFilled: studentRecords.length
      };
    }).filter(Boolean);

    let chartData = [];
    if (selectedReportClass) {
      chartData = studentAverages.map((student: any) => ({
        name: student.student_name,
        'Rata-rata Skor': student.averageScore,
      }));
    } else {
      chartData = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'].map(className => {
        const classStudents = studentAverages.filter((s: any) => s.class === className);
        const avgScore = classStudents.length > 0 ? Math.round(classStudents.reduce((sum, s: any) => sum + s.averageScore, 0) / classStudents.length) : 0;
        return {
          name: className,
          'Rata-rata Skor': avgScore,
        };
      });
    }

    return (
      <div className="bg-white rounded-3xl shadow-2xl p-8">
        <button onClick={() => setCurrentPage('home')} className="mb-6 bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-xl">← Kembali ke Beranda</button>
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-yellow-700">📈 Rekap Bulanan</h2>
        </div>
        
        <div className="flex flex-wrap gap-4 mb-6 justify-center">
          <select 
            value={selectedReportClass} 
            onChange={(e) => setSelectedReportClass(e.target.value)}
            className="p-3 border-2 border-yellow-300 rounded-xl focus:border-yellow-500 focus:outline-none"
          >
            <option value="">Semua Kelas</option>
            {['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="p-3 border-2 border-yellow-300 rounded-xl focus:border-yellow-500 focus:outline-none"
          >
            {Array.from({length: 12}, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('id-ID', { month: 'long' })}</option>
            ))}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="p-3 border-2 border-yellow-300 rounded-xl focus:border-yellow-500 focus:outline-none"
          >
            {[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - 2 + i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
        </div>

        {chartData.length > 0 && (
          <div className="mb-8 bg-yellow-50 p-6 rounded-2xl border-2 border-yellow-100">
            <h3 className="text-xl font-bold text-center text-yellow-800 mb-6">
              Grafik Rata-rata Skor {selectedReportClass ? `Siswa ${selectedReportClass}` : 'Per Kelas'}
            </h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Rata-rata Skor" fill="#eab308" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-yellow-500 text-white">
                <th className="p-3 border">Nama</th>
                <th className="p-3 border">Kelas</th>
                <th className="p-3 border">Hari Mengisi</th>
                <th className="p-3 border">Rata-rata Skor %</th>
                <th className="p-3 border">Kategori</th>
              </tr>
            </thead>
            <tbody>
              {studentAverages.length > 0 ? studentAverages.map((student: any) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="p-3 border">{student.student_name}</td>
                  <td className="p-3 border text-center">{student.class}</td>
                  <td className="p-3 border text-center">{student.daysFilled} hari</td>
                  <td className="p-3 border text-center font-bold">{student.averageScore}%</td>
                  <td className="p-3 border text-center">{student.category}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">Tidak ada data untuk bulan ini.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSemesterReportPage = () => {
    const filteredRecords = habitRecords.filter(record => {
      const recordDate = new Date(record.date);
      const isFirstHalf = recordDate.getMonth() < 6; // Jan - Jun
      const recordSemester = isFirstHalf ? 2 : 1;
      if (selectedReportClass && record.class !== selectedReportClass) return false;
      return recordSemester === selectedSemester && recordDate.getFullYear() === selectedSemesterYear;
    });

    const filteredStudents = selectedReportClass ? students.filter(s => s.class === selectedReportClass) : students;

    const studentAverages = filteredStudents.map(student => {
      const studentRecords = filteredRecords.filter(r => r.student_name === student.student_name && r.class === student.class);
      if (studentRecords.length === 0) return null;
      
      const totalScore = studentRecords.reduce((sum, record) => sum + record.total_score, 0);
      const averageScore = Math.round(totalScore / studentRecords.length);
      
      return {
        ...student,
        averageScore,
        category: getCategory(averageScore),
        daysFilled: studentRecords.length
      };
    }).filter(Boolean);

    // Calculate monthly data for chart
    const semesterMonths = selectedSemester === 1 ? [7, 8, 9, 10, 11, 12] : [1, 2, 3, 4, 5, 6];
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    const chartData = semesterMonths.map(month => {
      const monthRecords = filteredRecords.filter(r => new Date(r.date).getMonth() + 1 === month);
      const avg = monthRecords.length > 0 
        ? Math.round(monthRecords.reduce((sum, r) => sum + r.total_score, 0) / monthRecords.length)
        : 0;
      return {
        name: monthNames[month - 1],
        skor: avg
      };
    });

    const handlePrint = () => {
      window.print();
    };

    const handleExportWord = () => {
      const elementId = 'printable-report';
      const filename = `Rekap_Semester_${selectedReportClass || 'Semua'}_${selectedSemesterYear}_S${selectedSemester}`;
      const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid black; padding: 8px; text-align: left; } .text-center { text-align: center; } .font-bold { font-weight: bold; } .kop { text-align: center; border-bottom: 3px double black; padding-bottom: 10px; margin-bottom: 20px; } .kop h1 { margin: 0; font-size: 20pt; } .kop p { margin: 0; font-size: 10pt; } .signature-table { width: 100%; margin-top: 50px; border: none !important; } .signature-table td { border: none !important; }</style></head><body>";
      const postHtml = "</body></html>";
      const content = document.getElementById(elementId)?.innerHTML || '';
      const html = preHtml + content + postHtml;

      const blob = new Blob(['\ufeff', html], {
        type: 'application/msword'
      });
      
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      document.body.appendChild(downloadLink);
      downloadLink.href = url;
      downloadLink.download = filename + '.doc';
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    };

    const downloadChart = () => {
      const svg = document.querySelector('.semester-chart svg');
      if (!svg) return;

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      const svgSize = svg.getBoundingClientRect();
      canvas.width = svgSize.width * 2; // Higher resolution
      canvas.height = svgSize.height * 2;
      
      img.onload = () => {
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const pngUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = `Grafik_Kemajuan_${selectedReportClass || 'Semua'}_S${selectedSemester}.png`;
          downloadLink.click();
        }
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    return (
      <div className="bg-white rounded-3xl shadow-2xl p-8">
        <button onClick={() => setCurrentPage('home')} className="mb-6 bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-xl print:hidden">← Kembali ke Beranda</button>
        <div className="text-center mb-6 print:hidden">
          <h2 className="text-3xl font-bold text-purple-700">🏆 Rekap Semester</h2>
        </div>
        
        <div className="bg-purple-50 p-6 rounded-2xl mb-8 border-2 border-purple-100 print:hidden">
          <h3 className="text-xl font-bold mb-4 text-purple-800">⚙️ Pengaturan Laporan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1">Nama Sekolah:</label>
              <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Alamat Sekolah:</label>
              <input type="text" value={schoolAddress} onChange={(e) => setSchoolAddress(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Nama Kepala Sekolah:</label>
              <input type="text" value={principalName} onChange={(e) => setPrincipalName(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">NIP Kepala Sekolah (Opsional):</label>
              <input type="text" value={principalNip} onChange={(e) => setPrincipalNip(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="Contoh: 19800101 200501 1 001" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Nama Guru Kelas:</label>
              <input type="text" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">NIP Guru Kelas (Opsional):</label>
              <input type="text" value={teacherNip} onChange={(e) => setTeacherNip(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="Contoh: 19850202 201001 2 002" />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 justify-center">
            <button onClick={() => setShowReportPreview(true)} className="bg-purple-600 hover:bg-purple-700 text-white py-3 px-8 rounded-xl font-bold shadow-lg flex items-center gap-2">
              👁️ Preview Laporan
            </button>
          </div>
        </div>

        <div className="mb-8 bg-white p-6 rounded-2xl border-2 border-purple-100 print:hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-purple-800">📈 Grafik Kemajuan Semester</h3>
            <button onClick={downloadChart} className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-bold flex items-center gap-2">
              📥 Download Grafik
            </button>
          </div>
          <div className="h-[300px] w-full semester-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="skor" name="Rata-rata Skor (%)" fill="#9333ea" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6 justify-center print:hidden">
          <select 
            value={selectedReportClass} 
            onChange={(e) => setSelectedReportClass(e.target.value)}
            className="p-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none"
          >
            <option value="">Semua Kelas</option>
            {['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select 
            value={selectedSemester} 
            onChange={(e) => setSelectedSemester(Number(e.target.value))}
            className="p-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none"
          >
            <option value={1}>Semester 1 (Jul - Des)</option>
            <option value={2}>Semester 2 (Jan - Jun)</option>
          </select>
          <select 
            value={selectedSemesterYear} 
            onChange={(e) => setSelectedSemesterYear(Number(e.target.value))}
            className="p-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none"
          >
            {[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - 2 + i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-purple-500 text-white">
                <th className="p-3 border">Nama</th>
                <th className="p-3 border">Kelas</th>
                <th className="p-3 border">Hari Mengisi</th>
                <th className="p-3 border">Rata-rata Skor %</th>
                <th className="p-3 border">Kategori</th>
              </tr>
            </thead>
            <tbody>
              {studentAverages.length > 0 ? studentAverages.map((student: any) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="p-3 border">{student.student_name}</td>
                  <td className="p-3 border text-center">{student.class}</td>
                  <td className="p-3 border text-center">{student.daysFilled} hari</td>
                  <td className="p-3 border text-center font-bold">{student.averageScore}%</td>
                  <td className="p-3 border text-center">{student.category}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">Tidak ada data untuk semester ini.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showReportPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full p-8 shadow-2xl relative my-8">
              <button onClick={() => setShowReportPreview(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl print:hidden">✕</button>
              
              <div className="flex gap-4 mb-6 print:hidden">
                <button onClick={handlePrint} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                  🖨️ Cetak Laporan
                </button>
                <button onClick={handleExportWord} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                  📄 Simpan Word (.doc)
                </button>
              </div>

              <div id="printable-report" className="bg-white p-4 text-black font-serif">
                {/* Kop Sekolah */}
                <div className="flex items-center border-b-4 border-double border-black pb-4 mb-6">
                  <div className="flex-1 text-center">
                    <h1 className="text-2xl font-bold uppercase">{schoolName}</h1>
                    <p className="text-sm italic">{schoolAddress}</p>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-center underline mb-6 uppercase">LAPORAN REKAPITULASI SEMESTER</h2>
                
                <div className="mb-4 grid grid-cols-2 text-sm">
                  <div>
                    <p><b>Kelas:</b> {selectedReportClass || 'Semua Kelas'}</p>
                    <p><b>Semester:</b> {selectedSemester}</p>
                  </div>
                  <div className="text-right">
                    <p><b>Tahun:</b> {selectedSemesterYear}</p>
                    <p><b>Tanggal Cetak:</b> {new Date().toLocaleDateString('id-ID')}</p>
                  </div>
                </div>

                <table className="w-full border-collapse border border-black text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-black p-2 text-center w-10">No</th>
                      <th className="border border-black p-2">Nama Siswa</th>
                      <th className="border border-black p-2 text-center">Kelas</th>
                      <th className="border border-black p-2 text-center">Skor (%)</th>
                      <th className="border border-black p-2">Kategori</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentAverages.map((student: any, index: number) => (
                      <tr key={student.id}>
                        <td className="border border-black p-2 text-center">{index + 1}</td>
                        <td className="border border-black p-2">{student.student_name}</td>
                        <td className="border border-black p-2 text-center">{student.class}</td>
                        <td className="border border-black p-2 text-center font-bold">{student.averageScore}%</td>
                        <td className="border border-black p-2">{student.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Tanda Tangan */}
                <div className="mt-12 grid grid-cols-2 text-center text-sm">
                  <div>
                    <p className="mb-20">Mengetahui,<br />Kepala Sekolah</p>
                    <p className="font-bold underline">{principalName}</p>
                    {principalNip && <p>NIP. {principalNip}</p>}
                  </div>
                  <div>
                    <p className="mb-20">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br />Guru Kelas</p>
                    <p className="font-bold underline">{teacherName}</p>
                    {teacherNip && <p>NIP. {teacherNip}</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTeacherManagementPage = () => (
    <div className="bg-white rounded-3xl shadow-2xl p-8">
      <button onClick={() => setCurrentPage('home')} className="mb-6 bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-xl">← Kembali ke Beranda</button>
      <h2 className="text-3xl font-bold text-center text-teal-700 mb-6">👨‍🏫 Kelola Data Guru</h2>
      
      <div className="bg-teal-50 p-6 rounded-2xl mb-8 border-2 border-teal-200">
        <h3 className="text-xl font-bold mb-4 text-teal-800">Tambah Akun Guru</h3>
        <form onSubmit={handleAddTeacher} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-bold mb-2">Nama Guru:</label>
            <input type="text" name="teacher-name" required placeholder="Contoh: Budi Santoso" className="w-full p-3 border-2 border-teal-300 rounded-xl focus:border-teal-500 focus:outline-none" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-bold mb-2">Email Guru (Akun Google):</label>
            <input type="email" name="teacher-email" required placeholder="Contoh: guru@gmail.com" className="w-full p-3 border-2 border-teal-300 rounded-xl focus:border-teal-500 focus:outline-none" />
          </div>
          <button type="submit" className="bg-teal-500 hover:bg-teal-600 text-white py-3 px-8 rounded-xl font-bold h-[52px]">➕ Tambah Guru</button>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold mb-4 text-teal-800">Daftar Guru Terdaftar ({teachersList.length})</h3>
        {teachersList.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Belum ada guru yang didaftarkan.</p>
        ) : (
          teachersList.map(teacher => (
            <div key={teacher.id} className="bg-white p-4 rounded-xl flex justify-between items-center border-2 border-gray-200 shadow-sm">
              <div>
                <p className="font-bold text-lg">{teacher.name}</p>
                <p className="text-sm text-gray-500">{teacher.email}</p>
                <p className="text-xs text-gray-400 mt-1">Ditambahkan: {new Date(teacher.addedAt).toLocaleDateString('id-ID')}</p>
              </div>
              <button onClick={() => handleRemoveTeacher(teacher.email)} className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-xl text-sm font-bold">🗑️ Hapus Akses</button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderAdminPage = () => (
    <div className="bg-white rounded-3xl shadow-2xl p-8">
      <button onClick={() => setCurrentPage('home')} className="mb-6 bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-xl">← Kembali ke Beranda</button>
      <h2 className="text-3xl font-bold text-center text-indigo-700 mb-6">👑 Kelola Akses Sekolah</h2>
      
      <div className="bg-indigo-50 p-6 rounded-2xl mb-8">
        <h3 className="text-xl font-bold mb-4">Tambah Email Sekolah yang Disetujui</h3>
        <form onSubmit={handleAddApprovedSchool} className="flex gap-4">
          <input type="email" name="school-email" required placeholder="email.sekolah@contoh.com" className="flex-1 p-3 border-2 border-indigo-300 rounded-xl focus:border-indigo-500 focus:outline-none" />
          <button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white py-3 px-8 rounded-xl font-bold">Setujui Akses</button>
        </form>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Daftar Sekolah yang Disetujui</h3>
        {approvedSchoolsList.length === 0 ? (
          <p className="text-gray-500">Belum ada sekolah yang disetujui.</p>
        ) : (
          <div className="space-y-3">
            {approvedSchoolsList.map(school => (
              <div key={school.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="font-bold text-lg">{school.email}</span>
                <button onClick={() => handleRemoveApprovedSchool(school.id)} className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-xl text-sm font-bold">Cabut Akses</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (checkingApproval && !isSharedMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <p className="text-xl text-gray-600">Memeriksa akses...</p>
        </div>
      </div>
    );
  }

  if (!isFirebaseAuthenticated && !isSharedMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-4xl font-bold text-purple-700 mb-4">SIMOCI3-G7KAIH</h1>
          <p className="text-xl text-gray-600 mb-8">Silakan masuk untuk melanjutkan</p>
          <button 
            onClick={signInWithGoogle}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-xl text-xl font-bold shadow-lg flex items-center justify-center gap-2"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Masuk dengan Google
          </button>
        </div>
      </div>
    );
  }

  if (!isSharedMode && !isApproved && !isOwner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-4xl font-bold text-red-600 mb-4">Akses Ditolak</h1>
          <p className="text-xl text-gray-600 mb-8">Akun email Anda (<b>{auth.currentUser?.email}</b>) belum disetujui oleh pemilik aplikasi.</p>
          <p className="text-md text-gray-500 mb-8">Silakan hubungi admin untuk meminta akses.</p>
          <button 
            onClick={() => auth.signOut()}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl text-xl font-bold shadow-lg"
          >
            Keluar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-4 font-sans">
      <div className="max-w-6xl mx-auto">
        {currentPage === 'home' && renderHomePage()}
        {currentPage === 'form' && renderFormPage()}
        {currentPage === 'student-management' && renderStudentManagementPage()}
        {currentPage === 'teacher-management' && renderTeacherManagementPage()}
        {currentPage === 'daily' && renderDailyReportPage()}
        {currentPage === 'monthly' && renderMonthlyReportPage()}
        {currentPage === 'semester' && renderSemesterReportPage()}
        {currentPage === 'admin' && isOwner && renderAdminPage()}
      </div>


      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-2xl font-bold mb-4 text-center">🔒 Masukkan Password Guru</h3>
            <div className="mb-4">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={passwordInput} 
                onChange={(e) => setPasswordInput(e.target.value)} 
                placeholder="Password" 
                className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none" 
              />
            </div>
            <div className="mb-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="w-5 h-5" />
                <span>Tampilkan Password</span>
              </label>
            </div>
            {passwordError && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-center">Password salah! Silakan coba lagi.</div>}
            <div className="flex gap-4">
              <button onClick={handlePasswordSubmit} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-xl font-bold">✅ Buka</button>
              <button onClick={() => setShowPasswordModal(false)} className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-6 rounded-xl font-bold">❌ Batal</button>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <div className={`fixed top-4 right-4 ${isErrorToast ? 'bg-red-500' : 'bg-green-500'} text-white py-4 px-6 rounded-xl shadow-2xl z-50`}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
