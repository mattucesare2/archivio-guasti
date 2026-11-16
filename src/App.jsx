import React, { useState, useEffect } from 'react';
import { Client, Databases, Storage, ID, Query } from 'appwrite';

// Configurazione Appwrite (inserisci qui i tuoi dati)
const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
const PROJECT_ID = ''; // Inserisci il tuo Project ID di Appwrite
const DATABASE_ID = 'archivio_db';
const CATEGORIES_COLLECTION_ID = 'categories';
const ISSUES_COLLECTION_ID = 'issues';
const BUCKET_ID = 'attachments';

let client, databases, storage;
try {
  client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(PROJECT_ID);
  databases = new Databases(client);
  storage = new Storage(client);
} catch (e) {
  console.error("Errore inizializzazione Appwrite", e);
}

const DEFAULT_CATEGORIES = [
  { id: '1', name: 'PLC & Automazione', color: '#2563eb' },
  { id: '2', name: 'Reti & Comunicazione', color: '#059669' },
  { id: '3', name: 'Azionamenti & Inverter', color: '#d97706' },
  { id: '4', name: 'Sensori & Sicurezza', color: '#dc2626' },
  { id: '5', name: 'Impiantistica', color: '#7c3aed' },
  { id: '6', name: 'Software/SCADA', color: '#db2777' }
];

export default function App() {
  const [issues, setIssues] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [currentIssue, setCurrentIssue] = useState(null);

  // Form stato
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0].name);
  const [status, setStatus] = useState('In Corso');
  const [priority, setPriority] = useState('Media');
  const [plant, setPlant] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [solution, setSolution] = useState('');
  const [tags, setTags] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  // Nuova categoria form
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#2563eb');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!PROJECT_ID) {
      // Modalità locale se non è impostato il Project ID
      const localIssues = localStorage.getItem('local_issues');
      const localCats = localStorage.getItem('local_cats');
      if (localIssues) setIssues(JSON.parse(localIssues));
      if (localCats) setCategories(JSON.parse(localCats));
      return;
    }

    try {
      const resCat = await databases.listDocuments(DATABASE_ID, CATEGORIES_COLLECTION_ID);
      if (resCat.documents.length > 0) {
        setCategories(resCat.documents.map(d => ({ id: d.$id, name: d.name, color: d.color })));
      }
      const resIss = await databases.listDocuments(DATABASE_ID, ISSUES_COLLECTION_ID);
      setIssues(resIss.documents);
    } catch (e) {
      console.error("Errore fetch dati Appwrite:", e);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    let fileUrl = currentIssue ? currentIssue.fileUrl : '';

    if (selectedFile && PROJECT_ID) {
      try {
        const uploaded = await storage.createFile(BUCKET_ID, ID.unique(), selectedFile);
        fileUrl = storage.getFileView(BUCKET_ID, uploaded.$id);
      } catch (err) {
        alert("Errore upload file: " + err.message);
      }
    }

    const issueData = {
      title,
      category,
      status,
      priority,
      plant,
      rootCause,
      solution,
      tags,
      fileUrl: fileUrl ? String(fileUrl) : ''
    };

    if (!PROJECT_ID) {
      // LocalStorage fallback
      const newItems = currentIssue 
        ? issues.map(i => i.id === currentIssue.id ? { ...issueData, id: currentIssue.id } : i)
        : [{ ...issueData, id: Date.now().toString() }, ...issues];
      setIssues(newItems);
      localStorage.setItem('local_issues', JSON.stringify(newItems));
      closeModal();
      return;
    }

    try {
      if (currentIssue) {
        await databases.updateDocument(DATABASE_ID, ISSUES_COLLECTION_ID, currentIssue.$id, issueData);
      } else {
        await databases.createDocument(DATABASE_ID, ISSUES_COLLECTION_ID, ID.unique(), issueData);
      }
      fetchData();
      closeModal();
    } catch (err) {
      alert("Errore salvataggio: " + err.message);
    }
  };

  const deleteIssue = async (id) => {
    if (!confirm("Sei sicuro di voler eliminare questa scheda?")) return;
    if (!PROJECT_ID) {
      const newItems = issues.filter(i => i.id !== id);
      setIssues(newItems);
      localStorage.setItem('local_issues', JSON.stringify(newItems));
      return;
    }
    try {
      await databases.deleteDocument(DATABASE_ID, ISSUES_COLLECTION_ID, id);
      fetchData();
    } catch (err) {
      alert("Errore eliminazione: " + err.message);
    }
  };

  const openModal = (issue = null) => {
    if (issue) {
      setCurrentIssue(issue);
      setTitle(issue.title || '');
      setCategory(issue.category || categories[0]?.name);
      setStatus(issue.status || 'In Corso');
      setPriority(issue.priority || 'Media');
      setPlant(issue.plant || '');
      setRootCause(issue.rootCause || '');
      setSolution(issue.solution || '');
      setTags(issue.tags || '');
      setFilePreview(issue.fileUrl || null);
    } else {
      setCurrentIssue(null);
      setTitle('');
      setCategory(categories[0]?.name || '');
      setStatus('In Corso');
      setPriority('Media');
      setPlant('');
      setRootCause('');
      setSolution('');
      setTags('');
      setFilePreview(null);
    }
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const filteredIssues = issues.filter(item => {
    const matchesSearch = (item.title + item.rootCause + item.solution + item.plant + item.tags)
      .toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCat === 'ALL' || item.category === filterCat;
    const matchesStatus = filterStatus === 'ALL' || item.status === filterStatus;
    const matchesPriority = filterPriority === 'ALL' || item.priority === filterPriority;
    return matchesSearch && matchesCat && matchesStatus && matchesPriority;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <span className="bg-blue-600 p-2 rounded-xl text-white">⚙️</span>
              Archivio Guasti & Soluzioni
            </h1>
            <p className="text-slate-400 text-sm mt-1">Gestione tecnica e troubleshooting industriale on-site e da remoto</p>
          </div>
          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <button onClick={() => setIsCatModalOpen(true)} className="flex-1 md:flex-none bg-slate-700 hover:bg-slate-600 px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
              🏷️ Gestisci Categorie
            </button>
            <button onClick={() => setIsGuideOpen(true)} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
              📖 Guida Appwrite
            </button>
            <button onClick={() => openModal()} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30">
              ➕ Nuovo Guasto
            </button>
          </div>
        </div>

        {/* Filtri e Ricerca */}
        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <input 
            type="text" 
            placeholder="🔍 Cerca guasto, causa, impianto..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
          />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none">
            <h>Tutte le Categorie</h>
            <option value="ALL">Tutte le Categorie</option>
            {categories.map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none">
            <option value="ALL">Tutti gli Stati</option>
            <option value="Risolto">Risolto</option>
            <option value="In Corso">In Corso</option>
            <option value="Monitoraggio">Monitoraggio</option>
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none">
            <option value="ALL">Tutte le Priorità</option>
            <option value="Critica">Critica</option>
            <option value="Alta">Alta</option>
            <option value="Media">Media</option>
            <option value="Bassa">Bassa</option>
          </select>
        </div>

        {/* Griglia Schede */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIssues.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-slate-400">
              Nessun guasto trovato. Clicca su "+ Nuovo Guasto" per aggiungerne uno.
            </div>
          ) : (
            filteredIssues.map(item => {
              const catObj = categories.find(c => c.name === item.category);
              const catColor = catObj ? catObj.color : '#2563eb';
              return (
                <div key={item.$id || item.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-6 flex flex-col justify-between shadow-lg hover:border-slate-600 transition">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-semibold px-3 py-1 rounded-full text-white" style={{ backgroundColor: catColor }}>
                        {item.category}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                          item.status === 'Risolto' ? 'bg-emerald-500/20 text-emerald-400' :
                          item.status === 'In Corso' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {item.status}
                        </span>
                        <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                          item.priority === 'Critica' ? 'bg-rose-500/20 text-rose-400' :
                          item.priority === 'Alta' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700 text-slate-300'
                        }`}>
                          {item.priority}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-100">{item.title}</h3>
                      {item.plant && <p className="text-xs text-blue-400 font-medium mt-1">📍 Impianto: {item.plant}</p>}
                    </div>

                    <div className="space-y-2 text-sm bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/50">
                      <div>
                        <span className="font-semibold text-slate-400 text-xs block mb-0.5">Causa Radice:</span>
                        <p className="text-slate-200">{item.rootCause || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-emerald-400 text-xs block mb-0.5">Soluzione Applicata:</span>
                        <p className="text-slate-200">{item.solution || '-'}</p>
                      </div>
                    </div>

                    {item.tags && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.tags.split(',').map((t, idx) => (
                          <span key={idx} className="text-xs bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-md">
                            #{t.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-700/60 flex items-center justify-between">
                    {item.fileUrl ? (
                      <a href={item.fileUrl} target="_blank" rel="noreferrer" className="text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-medium">
                        📎 Visualizza Allegato
                      </a>
                    ) : <span className="text-xs text-slate-500">Nessun allegato</span>}
                    
                    <div className="flex gap-2">
                      <button onClick={() => openModal(item)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition" title="Modifica">
                        ✏️
                      </button>
                      <button onClick={() => deleteIssue(item.$id || item.id)} className="p-2 hover:bg-rose-500/20 rounded-lg text-rose-400 transition" title="Elimina">
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Nuovo/Modifica Guasto */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">{currentIssue ? 'Modifica Guasto' : 'Registra Nuovo Guasto'}</h2>
                <button onClick={closeModal} className="text-slate-400 hover:text-white text-xl">✕</button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Titolo del Guasto *</label>
                  <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500" placeholder="Es. Blocco inverter nastro 3" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Categoria</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none">
                      {categories.map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Stato</label>
                    <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none">
                      <option value="In Corso">In Corso</option>
                      <option value="Monitoraggio">Monitoraggio</option>
                      <option value="Risolto">Risolto</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Priorità</label>
                    <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none">
                      <option value="Bassa">Bassa</option>
                      <option value="Media">Media</option>
                      <option value="Alta">Alta</option>
                      <option value="Critica">Critica</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Impianto / Linea / Posizione</label>
                  <input type="text" value={plant} onChange={e => setPlant(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none" placeholder="Es. Linea Confezionamento 2 - Stazione UPS" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Causa Radice</label>
                  <textarea rows={2} value={rootCause} onChange={e => setRootCause(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none" placeholder="Perché si è verificato il guasto?"></textarea>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Soluzione Applicata</label>
                  <textarea rows={3} value={solution} onChange={e => setSolution(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none" placeholder="Come è stato risolto l'intervento?"></textarea>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Tag (separati da virgola)</label>
                  <input type="text" value={tags} onChange={e => setTags(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none" placeholder="siemens, inverter, errore-f03" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Allegato (PDF, Foto, Schema)</label>
                  <input type="file" onChange={e => setSelectedFile(e.target.files[0])} className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer" />
                  {filePreview && !selectedFile && (
                    <p className="text-xs text-blue-400 mt-1">📎 File attuale caricato presente.</p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                  <button type="button" onClick={closeModal} className="bg-slate-700 hover:bg-slate-600 px-5 py-2.5 rounded-xl text-sm font-medium transition">Annulla</button>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg shadow-blue-600/30">Salva Scheda</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Gestione Categorie */}
        {isCatModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">🏷️ Gestione Categorie</h2>
                <button onClick={() => setIsCatModalOpen(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {categories.map((cat, idx) => (
                  <div key={cat.id || idx} className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-700">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full inline-block shadow" style={{ backgroundColor: cat.color }}></span>
                      <span className="font-medium text-sm">{cat.name}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-700 space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Aggiungi Nuova Categoria</h3>
                <div className="flex gap-3">
                  <input type="text" placeholder="Nome categoria..." value={newCatName} onChange={e => setNewCatName(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm focus:outline-none" />
                  <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="w-12 h-10 bg-slate-900 border border-slate-700 rounded-xl cursor-pointer p-1" />
                  <button onClick={async () => {
                    if (!newCatName.trim()) return;
                    const newCat = { name: newCatName.trim(), color: newCatColor };
                    if (!PROJECT_ID) {
                      const updated = [...categories, { ...newCat, id: Date.now().toString() }];
                      setCategories(updated);
                      localStorage.setItem('local_cats', JSON.stringify(updated));
                      setNewCatName('');
                      return;
                    }
                    try {
                      await databases.createDocument(DATABASE_ID, CATEGORIES_COLLECTION_ID, ID.unique(), newCat);
                      setNewCatName('');
                      fetchData();
                    } catch (err) {
                      alert("Errore creazione categoria: " + err.message);
                    }
                  }} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-sm font-semibold transition">Aggiungi</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Guida Appwrite */}
        {isGuideOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">📖 Configurazione Appwrite Cloud</h2>
                <button onClick={() => setIsGuideOpen(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
              </div>
              <div className="text-sm text-slate-300 space-y-3">
                <p>Per collegare l'app al tuo cloud Appwrite gratuito:</p>
                <ol className="list-decimal list-inside space-y-2 text-slate-200">
                  <li>Crea un progetto su <a href="https://cloud.appwrite.io" target="_blank" rel="noreferrer" className="text-blue-400 underline">cloud.appwrite.io</a>.</li>
                  <li>Crea un database denominato <code className="bg-slate-900 px-2 py-0.5 rounded text-blue-300">archivio_db</code>.</li>
                  <li>Crea la tabella <code className="bg-slate-900 px-2 py-0.5 rounded text-blue-300">categories