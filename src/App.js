import React, { useEffect, useState, useTransition } from 'react';
import supabase from './supabase';
import './style.css';

const CATEGORIES = [
  { name: 'technology', color: '#3b82f6' },
  { name: 'science', color: '#16a34a' },
  { name: 'finance', color: '#ef4444' },
  { name: 'society', color: '#eab308' },
  { name: 'entertainment', color: '#db2777' },
  { name: 'health', color: '#14b8a6' },
  { name: 'history', color: '#f97316' },
  { name: 'news', color: '#8b5cf6' },
];

function App() {
  const [showForm, setShowForm] = useState(false);
  const [facts, setFacts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('all');
  const [isPending, startTransition] = useTransition();
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'dark'
  );

  // Apply theme and persist
  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Fetch facts from Supabase
  useEffect(() => {
    let ignore = false;
    async function getFacts() {
      setIsLoading(true);
      try {
        let query = supabase.from('facts').select('*');
        if (currentCategory !== 'all') {
          query = query.eq('category', currentCategory);
        }
        const { data, error } = await query
          .order('votesInteresting', { ascending: false })
          .limit(1000);
        if (!ignore && !error) setFacts(data);
        if (error) throw error;
      } catch {
        alert('There was a problem retrieving the facts!');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    getFacts();
    return () => { ignore = true; };
  }, [currentCategory]);

  return (
    <>
      <Header
        showForm={showForm}
        setShowForm={setShowForm}
        theme={theme}
        setTheme={setTheme}
      />
      {showForm && <NewFactForm setFacts={setFacts} setShowForm={setShowForm} />}
      <main className="main">
        <CategoryFilter setCurrentCategory={(cat) => startTransition(() => setCurrentCategory(cat))} />
        {isLoading ? <Loader /> : <FactList facts={facts} setFacts={setFacts} />}
      </main>
    </>
  );
}

function Loader() {
  return <p className="message">Loading ...</p>;
}

function Header({ showForm, setShowForm, theme, setTheme }) {
  return (
    <header className="header">
      <div className="logo">
        <img src="logo.png" alt="Today I Learned Logo" />
        <h1>Today I Learned</h1>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          className="btn btn-large btn-open"
          onClick={() => setShowForm((s) => !s)}
        >
          {showForm ? 'Close' : 'Share a fact'}
        </button>
        <button
          className="btn btn-large"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '🌞 Light' : '🌙 Dark'}
        </button>
      </div>
    </header>
  );
}

function isValidHttpUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function NewFactForm({ setFacts, setShowForm }) {
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Handle image selection and preview
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setImage(null);
      setImagePreview(null);
    }
  };

  // Clear image selection
  const handleClearImage = () => {
    setImage(null);
    setImagePreview(null);
    // Reset the file input
    const fileInput = document.getElementById('image-upload');
    if (fileInput) fileInput.value = '';
  };

  async function handleSubmit(e) {
    e.preventDefault();
    
    // Validation
    if (!text || !isValidHttpUrl(source) || !category || text.length > 200) {
      alert('Please fill in all required fields and ensure the source is a valid URL.');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      let imageUrl = '';
      
      // First try to insert the fact record without the image
      // This will help identify if the issue is with the database insert or storage
      const { data: factData, error: factError } = await supabase
        .from('facts')
        .insert([{ 
          text, 
          source, 
          category,
          image_url: '',  // Temporarily empty 
          votesInteresting: 0,
          votesMindblowing: 0,
          votesFalse: 0
        }])
        .select();
      
      if (factError) {
        throw new Error(`Error inserting fact: ${factError.message}`);
      }
      
      const factId = factData[0].id;
      
      // If an image was selected, upload it and update the fact
      if (image) {
        const fileName = `fact_${factId}_${Date.now()}_${image.name.replace(/\s+/g, '_')}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase
          .storage
          .from('fact-images')
          .upload(fileName, image, {
            cacheControl: '3600',
            upsert: false,
            onUploadProgress: (progress) => {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              setUploadProgress(percent);
            }
          });
        
        if (uploadError) {
          // Log the error but don't throw - we want to keep the fact even if image upload fails
          console.error('Image upload error:', uploadError);
          alert(`Fact was saved but there was an issue uploading the image: ${uploadError.message}`);
        } else {
          // Get the public URL of the uploaded image
          const { data: urlData } = supabase
            .storage
            .from('fact-images')
            .getPublicUrl(fileName);
          
          imageUrl = urlData.publicUrl;
          
          // Update the fact with the image URL
          const { error: updateError } = await supabase
            .from('facts')
            .update({ image_url: imageUrl })
            .eq('id', factId);
          
          if (updateError) {
            console.error('Error updating fact with image:', updateError);
            alert(`Fact was saved but there was an issue linking the image: ${updateError.message}`);
          }
        }
      }
      
      // Update the facts list with the new fact
      setFacts((facts) => [
        { ...factData[0], image_url: imageUrl }, 
        ...facts
      ]);
      
      // Reset form fields
      setText('');
      setSource('');
      setCategory('');
      setImage(null);
      setImagePreview(null);
      setShowForm(false);
      
    } catch (error) {
      console.error('Error uploading fact:', error);
      alert('Error uploading the fact! ' + error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }

  return (
    <form className="fact-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Share a fact with the world..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isUploading}
      />
      <span>{200 - text.length}</span>
      
      <input
        type="text"
        placeholder="Trustworthy source..."
        value={source}
        onChange={(e) => setSource(e.target.value)}
        disabled={isUploading}
      />
      
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        disabled={isUploading}
      >
        <option value="">Choose category:</option>
        {CATEGORIES.map((cat) => (
          <option key={cat.name} value={cat.name}>
            {cat.name.toUpperCase()}
          </option>
        ))}
      </select>
      
      {/* Image Upload Section */}
      <div className="image-upload-container">
        <input
          id="image-upload"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          disabled={isUploading}
          className="image-input"
        />
        
        <label htmlFor="image-upload" className="image-upload-label">
          {imagePreview ? "Change Image" : "Upload Image"}
        </label>
        
        {imagePreview && (
          <div className="image-preview-container">
            <img 
              src={imagePreview} 
              alt="Preview" 
              className="image-preview" 
            />
            <button 
              type="button" 
              className="clear-image-btn"
              onClick={handleClearImage}
              disabled={isUploading}
            >
              ✕
            </button>
          </div>
        )}
        
        {isUploading && uploadProgress > 0 && (
          <div className="upload-progress">
            <div 
              className="progress-bar" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
            <span className="progress-text">{uploadProgress}%</span>
          </div>
        )}
      </div>
      
      <button 
        className="btn btn-large" 
        disabled={isUploading}
      >
        {isUploading ? "Posting..." : "Post"}
      </button>
    </form>
  );
}

function CategoryFilter({ setCurrentCategory }) {
  return (
    <aside>
      <ul>
        <li className="category">
          <button
            className="btn btn-all-categories"
            onClick={() => setCurrentCategory('all')}
          >
            All
          </button>
        </li>
        {CATEGORIES.map((cat) => (
          <li key={cat.name} className="category">
            <button
              className="btn btn-category"
              onClick={() => setCurrentCategory(cat.name)}
              style={{ backgroundColor: cat.color }}
            >
              {cat.name}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function FactList({ facts, setFacts }) {
  if (!facts.length) {
    return (
      <p className="message">
        Currently there's no facts for this category yet! Create the first one!
      </p>
    );
  }
  return (
    <section>
      <ul className="facts-list">
        {facts.map((fact) => (
          <Fact key={fact.id} fact={fact} setFacts={setFacts} />
        ))}
      </ul>
      <p>There are {facts.length} facts in the database. Add your own!</p>
    </section>
  );
}

function Fact({ fact, setFacts }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const isDisputed = fact.votesInteresting < fact.votesFalse;

  async function handleVote(columnName) {
    setIsUpdating(true);
    try {
      const { data, error } = await supabase
        .from('facts')
        .update({ [columnName]: fact[columnName] + 1 })
        .eq('id', fact.id)
        .select();
      if (error) throw error;
      setFacts((facts) => facts.map((f) => (f.id === fact.id ? data[0] : f)));
    } catch {
      alert('Error voting!');
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <li className="fact">
      <div className="fact-content">
        <p>
          {isDisputed && <span className="disputed">[⛔ DISPUTED]</span>}
          {fact.text}
          <a className="source" href={fact.source} target="_blank" rel="noreferrer">
            (Source)
          </a>
        </p>
        
        {/* Image display with click to expand/collapse */}
        {fact.image_url && fact.image_url !== '' && (
          <div className={`fact-image-container ${isImageExpanded ? 'expanded' : ''}`}>
            <img 
              src={fact.image_url} 
              alt="Fact image" 
              className="fact-image"
              onClick={() => setIsImageExpanded(!isImageExpanded)}
            />
            <span className="image-zoom-hint">
              {isImageExpanded ? 'Click to collapse' : 'Click to expand'}
            </span>
          </div>
        )}
      </div>
      
      <div className="fact-meta">
        <span
          className="tag"
          style={{
            backgroundColor: CATEGORIES.find((cat) => cat.name === fact.category)?.color,
          }}
        >
          {fact.category}
        </span>
        
        <div className="vote-buttons">
          <button onClick={() => handleVote('votesInteresting')} disabled={isUpdating}>
            👍 {fact.votesInteresting}
          </button>
          <button onClick={() => handleVote('votesFalse')} disabled={isUpdating}>
            ⛔ {fact.votesFalse}
          </button>
        </div>
      </div>
    </li>
  );
}

export default App;
